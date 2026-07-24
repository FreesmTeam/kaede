use super::authorizer::ResourceHandle;
use serde::Serialize;
use std::collections::btree_map::Entry;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::PathBuf;
use std::process::{Command as StdCommand, Stdio};
use std::sync::{Arc, Mutex, RwLock};
use tauri::async_runtime::{block_on, channel, Receiver, Sender};
use tauri::ipc::Channel;
use tauri_plugin_shellx::process::{Command, CommandEvent, TerminatedPayload};

#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;

#[derive(Debug)]
pub(super) struct ProcessCommand {
    command: Command,
    executable_guard: Option<File>,
    original_program: Option<PathBuf>,
}

impl ProcessCommand {
    pub(super) fn unbound(command: Command) -> Self {
        Self {
            command,
            executable_guard: None,
            original_program: None,
        }
    }

    pub(super) fn identity_bound(
        command: Command,
        executable_guard: File,
        original_program: PathBuf,
    ) -> Self {
        Self {
            command,
            executable_guard: Some(executable_guard),
            original_program: Some(original_program),
        }
    }

    fn into_std(self) -> (StdCommand, Option<File>) {
        let Self {
            command,
            executable_guard,
            original_program,
        } = self;
        #[cfg(unix)]
        let mut command: StdCommand = command.into();
        #[cfg(not(unix))]
        let command: StdCommand = command.into();

        #[cfg(unix)]
        if let Some(original_program) = original_program {
            command.arg0(original_program);
        }
        #[cfg(not(unix))]
        let _ = original_program;

        (command, executable_guard)
    }

    #[cfg(test)]
    pub(super) fn output_for_test(self) -> std::io::Result<std::process::Output> {
        let (mut command, executable_guard) = self.into_std();
        let output = command.output();

        drop(executable_guard);
        output
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum BrokerEvent {
    Stdout {
        handle: ResourceHandle,
        bytes: Vec<u8>,
    },
    Stderr {
        handle: ResourceHandle,
        bytes: Vec<u8>,
    },
    Terminated {
        handle: ResourceHandle,
        code: Option<i32>,
        signal: Option<i32>,
    },
    Error {
        handle: ResourceHandle,
        message: String,
    },
    Failed {
        handle: ResourceHandle,
        message: String,
    },
    DownloadProgress {
        transferred: u64,
        total: Option<u64>,
        bytes_per_second: u64,
    },
    DownloadBatchProgress {
        current: BTreeMap<PathBuf, (u8, u64)>,
        success: usize,
        failed: usize,
    },
}

trait ChildControl: Send {
    fn pid(&self) -> u32;
    fn try_wait(&mut self) -> Result<bool, String>;
    fn kill(&mut self) -> Result<(), String>;
    fn wait(&mut self) -> Result<(), String>;
}

struct TrackedChild {
    child: Arc<shared_child::SharedChild>,
}

impl ChildControl for TrackedChild {
    fn pid(&self) -> u32 {
        self.child.id()
    }

    fn try_wait(&mut self) -> Result<bool, String> {
        self.child
            .try_wait()
            .map(|status| status.is_some())
            .map_err(|error| error.to_string())
    }

    fn kill(&mut self) -> Result<(), String> {
        self.child.kill().map_err(|error| error.to_string())
    }

    fn wait(&mut self) -> Result<(), String> {
        self.child
            .wait()
            .map(|_| ())
            .map_err(|error| error.to_string())
    }
}

#[derive(Debug, Default)]
pub(super) struct ProcessArtifacts {
    owned_files: Vec<PathBuf>,
}

impl ProcessArtifacts {
    pub(super) fn owning_file(path: PathBuf) -> Self {
        Self {
            owned_files: vec![path],
        }
    }
}

impl Drop for ProcessArtifacts {
    fn drop(&mut self) {
        for path in &self.owned_files {
            if let Err(error) = std::fs::remove_file(path) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    log::error!(
                        target: "capability_broker",
                        "could not remove owned process artifact {}: {error}",
                        path.display()
                    );
                }
            }
        }
    }
}

struct ProcessResource {
    child: Box<dyn ChildControl>,
    _artifacts: ProcessArtifacts,
    events: Option<Channel<BrokerEvent>>,
    retained_failure: Option<String>,
}

#[derive(Default)]
pub struct ProcessStore {
    children: Mutex<BTreeMap<ResourceHandle, ProcessResource>>,
}

#[derive(Debug)]
pub(super) struct ProcessKillFailure {
    pub handle: ResourceHandle,
    pub message: String,
}

#[derive(Default)]
pub(super) struct ProcessKillSummary {
    pub killed: Vec<ResourceHandle>,
    pub failures: Vec<ProcessKillFailure>,
    pub terminal_failures: Vec<RetainedTerminalFailure>,
}

pub(super) struct RetainedTerminalFailure {
    channel: Channel<BrokerEvent>,
    event: BrokerEvent,
}

impl RetainedTerminalFailure {
    pub(super) fn send(self) {
        if let Err(error) = self.channel.send(self.event) {
            log::error!(
                target: "capability_broker",
                "could not send retained terminal process failure: {error}"
            );
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ProcessStreamEnd {
    Terminated {
        code: Option<i32>,
        signal: Option<i32>,
    },
    ClosedWithoutTermination {
        message: String,
    },
}

impl ProcessStore {
    pub fn spawn_command(
        &self,
        handle: ResourceHandle,
        command: ProcessCommand,
        artifacts: ProcessArtifacts,
        events: Option<Channel<BrokerEvent>>,
    ) -> Result<(Receiver<CommandEvent>, u32), String> {
        let ((receiver, child), artifacts) =
            spawn_with_artifacts(artifacts, || spawn_tracked_command(command))?;
        let pid = self.insert_boxed_with_artifacts_and_events(
            handle,
            Box::new(child),
            artifacts,
            events,
        )?;
        Ok((receiver, pid))
    }

    pub fn kill(&self, handle: &ResourceHandle) -> Result<Option<RetainedTerminalFailure>, String> {
        self.terminate_and_remove(handle, false)
    }

    pub(super) fn kill_for_cleanup(
        &self,
        handle: &ResourceHandle,
    ) -> Result<Option<RetainedTerminalFailure>, String> {
        self.terminate_and_remove(handle, true)
    }

    pub(super) fn finish_failed_stream(
        &self,
        handle: &ResourceHandle,
        message: String,
    ) -> Result<(), String> {
        let mut children = self
            .children
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let Some(resource) = children.get_mut(handle) else {
            // A concurrent backend-observed termination may already have removed the child.
            return Ok(());
        };
        if let Err(error) = terminate_child(resource.child.as_mut()) {
            resource.retained_failure = Some(message);
            return Err(error);
        }
        children.remove(handle);
        Ok(())
    }

    fn terminate_and_remove(
        &self,
        handle: &ResourceHandle,
        missing_is_success: bool,
    ) -> Result<Option<RetainedTerminalFailure>, String> {
        let retained_terminal = {
            let mut children = self
                .children
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let Some(resource) = children.get_mut(handle) else {
                return if missing_is_success {
                    Ok(None)
                } else {
                    Err("process handle is unknown".to_owned())
                };
            };
            terminate_child(resource.child.as_mut())?;
            let mut resource = children
                .remove(handle)
                .expect("confirmed process resource should remain present until removal");
            let retained_terminal = resource
                .events
                .take()
                .zip(resource.retained_failure.take())
                .map(|(channel, message)| RetainedTerminalFailure {
                    channel,
                    event: BrokerEvent::Failed {
                        handle: handle.clone(),
                        message,
                    },
                });
            drop(resource);
            retained_terminal
        };
        Ok(retained_terminal)
    }

    pub fn remove_finished(&self, handle: &ResourceHandle) -> bool {
        self.children
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(handle)
            .is_some()
    }

    pub fn kill_all<'a>(
        &self,
        handles: impl IntoIterator<Item = &'a ResourceHandle>,
    ) -> ProcessKillSummary {
        const ATTEMPTS: usize = 2;

        let mut summary = ProcessKillSummary::default();
        for handle in handles {
            let mut last_error = None;
            for _ in 0..ATTEMPTS {
                match self.kill_for_cleanup(handle) {
                    Ok(terminal_failure) => {
                        summary.killed.push(handle.clone());
                        if let Some(terminal_failure) = terminal_failure {
                            summary.terminal_failures.push(terminal_failure);
                        }
                        last_error = None;
                        break;
                    }
                    Err(message) => last_error = Some(message),
                }
            }
            if let Some(message) = last_error {
                summary.failures.push(ProcessKillFailure {
                    handle: handle.clone(),
                    message,
                });
            }
        }
        summary
    }

    #[cfg(test)]
    fn insert_boxed_with_artifacts(
        &self,
        handle: ResourceHandle,
        child: Box<dyn ChildControl>,
        artifacts: ProcessArtifacts,
    ) -> Result<u32, String> {
        self.insert_boxed_with_artifacts_and_events(handle, child, artifacts, None)
    }

    fn insert_boxed_with_artifacts_and_events(
        &self,
        handle: ResourceHandle,
        mut child: Box<dyn ChildControl>,
        artifacts: ProcessArtifacts,
        events: Option<Channel<BrokerEvent>>,
    ) -> Result<u32, String> {
        let pid = child.pid();
        let mut children = self
            .children
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        match children.entry(handle) {
            Entry::Vacant(entry) => {
                entry.insert(ProcessResource {
                    child,
                    _artifacts: artifacts,
                    events,
                    retained_failure: None,
                });
            }
            Entry::Occupied(_) => {
                let _ = terminate_child(child.as_mut());
                return Err("process handle is already present".to_owned());
            }
        }
        Ok(pid)
    }

    #[cfg(test)]
    fn insert_boxed(
        &self,
        handle: ResourceHandle,
        child: Box<dyn ChildControl>,
    ) -> Result<u32, String> {
        self.insert_boxed_with_artifacts(handle, child, ProcessArtifacts::default())
    }

    #[cfg(test)]
    fn contains(&self, handle: &ResourceHandle) -> bool {
        self.children
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .contains_key(handle)
    }
}

fn terminate_child(child: &mut dyn ChildControl) -> Result<(), String> {
    if child.try_wait()? {
        return Ok(());
    }
    child.kill()?;
    child.wait()
}

fn spawn_with_artifacts<T>(
    artifacts: ProcessArtifacts,
    spawn: impl FnOnce() -> Result<T, String>,
) -> Result<(T, ProcessArtifacts), String> {
    let spawned = spawn()?;
    Ok((spawned, artifacts))
}

fn spawn_tracked_command(
    command: ProcessCommand,
) -> Result<(Receiver<CommandEvent>, TrackedChild), String> {
    let (mut command, executable_guard) = command.into_std();
    let (stdout_reader, stdout_writer) = os_pipe::pipe().map_err(|error| error.to_string())?;
    let (stderr_reader, stderr_writer) = os_pipe::pipe().map_err(|error| error.to_string())?;
    command
        .stdout(Stdio::from(stdout_writer))
        .stderr(Stdio::from(stderr_writer))
        .stdin(Stdio::null());
    let spawned = shared_child::SharedChild::spawn(&mut command);

    drop(executable_guard);
    let child = Arc::new(spawned.map_err(|error| error.to_string())?);
    let guard = Arc::new(RwLock::new(()));
    let (sender, receiver) = channel(1);
    spawn_pipe_reader(
        sender.clone(),
        Arc::clone(&guard),
        stdout_reader,
        CommandEvent::Stdout,
    );
    spawn_pipe_reader(
        sender.clone(),
        Arc::clone(&guard),
        stderr_reader,
        CommandEvent::Stderr,
    );
    let waiter = Arc::clone(&child);
    std::thread::spawn(move || {
        let event = match waiter.wait() {
            Ok(status) => CommandEvent::Terminated(TerminatedPayload {
                code: status.code(),
                #[cfg(unix)]
                signal: status.signal(),
                #[cfg(not(unix))]
                signal: None,
            }),
            Err(error) => CommandEvent::Error(error.to_string()),
        };
        let _output_finished = guard
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let _ = block_on(sender.send(event));
    });
    Ok((receiver, TrackedChild { child }))
}

fn spawn_pipe_reader(
    sender: Sender<CommandEvent>,
    guard: Arc<RwLock<()>>,
    reader: os_pipe::PipeReader,
    wrap: fn(Vec<u8>) -> CommandEvent,
) {
    std::thread::spawn(move || {
        let _reader_active = guard
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut reader = BufReader::new(reader);
        let mut buffer = [0_u8; 8 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(length) => {
                    if block_on(sender.send(wrap(buffer[..length].to_vec()))).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = block_on(sender.send(CommandEvent::Error(error.to_string())));
                    break;
                }
            }
        }
    });
}

pub fn forward_events(
    receiver: tauri::async_runtime::Receiver<CommandEvent>,
    handle: ResourceHandle,
    channel: Option<Channel<BrokerEvent>>,
    on_finished: impl FnOnce(ProcessStreamEnd, Option<Channel<BrokerEvent>>) -> Result<(), String>
        + Send
        + 'static,
) {
    tauri::async_runtime::spawn(forward_events_until_terminated(
        receiver,
        handle,
        channel,
        on_finished,
    ));
}

async fn forward_events_until_terminated(
    mut receiver: tauri::async_runtime::Receiver<CommandEvent>,
    handle: ResourceHandle,
    mut channel: Option<Channel<BrokerEvent>>,
    on_finished: impl FnOnce(ProcessStreamEnd, Option<Channel<BrokerEvent>>) -> Result<(), String>,
) {
    let mut last_error = None;
    while let Some(event) = receiver.recv().await {
        let event = match event {
            CommandEvent::Stdout(bytes) => BrokerEvent::Stdout {
                handle: handle.clone(),
                bytes,
            },
            CommandEvent::Stderr(bytes) => BrokerEvent::Stderr {
                handle: handle.clone(),
                bytes,
            },
            CommandEvent::Terminated(payload) => {
                if let Err(error) = on_finished(
                    ProcessStreamEnd::Terminated {
                        code: payload.code,
                        signal: payload.signal,
                    },
                    channel,
                ) {
                    log::error!(
                        target: "capability_broker",
                        "could not finalize terminated process {}: {error}",
                        handle.as_str()
                    );
                }
                return;
            }
            CommandEvent::Error(message) => {
                last_error = Some(message.clone());
                BrokerEvent::Error {
                    handle: handle.clone(),
                    message,
                }
            }
            _ => continue,
        };
        send_broker_event(&mut channel, event);
    }

    let message = last_error
        .unwrap_or_else(|| "process event stream ended before termination was observed".to_owned());
    if let Err(error) = on_finished(
        ProcessStreamEnd::ClosedWithoutTermination { message },
        channel,
    ) {
        log::error!(
            target: "capability_broker",
            "process {} event stream ended without termination; automatic cleanup failed and the process was retained: {error}",
            handle.as_str()
        );
    }
}

pub(super) fn send_broker_event(channel: &mut Option<Channel<BrokerEvent>>, event: BrokerEvent) {
    if channel
        .as_ref()
        .is_some_and(|channel| channel.send(event).is_err())
    {
        *channel = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_broker::authorizer::{Authorizer, Principal, SessionToken};
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::{Arc, Barrier, Mutex};
    use tauri::ipc::InvokeResponseBody;

    struct FakeChild {
        pid: u32,
        killed: Arc<AtomicBool>,
        kill_failures_remaining: Arc<AtomicUsize>,
        wait_failures_remaining: Arc<AtomicUsize>,
        waited: Arc<AtomicBool>,
    }

    impl ChildControl for FakeChild {
        fn pid(&self) -> u32 {
            self.pid
        }

        fn try_wait(&mut self) -> Result<bool, String> {
            Ok(self.killed.load(Ordering::Relaxed))
        }

        fn kill(&mut self) -> Result<(), String> {
            let remaining = self.kill_failures_remaining.load(Ordering::Relaxed);
            if remaining > 0 {
                self.kill_failures_remaining.fetch_sub(1, Ordering::Relaxed);
                Err("injected kill failure".to_owned())
            } else {
                self.killed.store(true, Ordering::Relaxed);
                Ok(())
            }
        }

        fn wait(&mut self) -> Result<(), String> {
            self.waited.store(true, Ordering::Relaxed);
            let remaining = self.wait_failures_remaining.load(Ordering::Relaxed);
            if remaining > 0 {
                self.wait_failures_remaining.fetch_sub(1, Ordering::Relaxed);
                Err("injected wait failure".to_owned())
            } else {
                Ok(())
            }
        }
    }

    fn create_owned_script(name: &str) -> PathBuf {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let path = std::env::temp_dir().join(format!(
            "kaede-process-artifact-{name}-{}-{suffix}.js",
            std::process::id()
        ));
        std::fs::write(&path, b"export default true;")
            .expect("owned script fixture should be written");
        path
    }

    #[test]
    fn spawn_failure_removes_owned_process_artifacts() {
        let script = create_owned_script("spawn-failure");
        let error =
            spawn_with_artifacts::<()>(ProcessArtifacts::owning_file(script.clone()), || {
                Err("injected spawn failure".to_owned())
            })
            .expect_err("spawn should fail");

        assert_eq!(error, "injected spawn failure");
        assert!(!script.exists());
    }

    #[test]
    fn backend_observed_termination_removes_owned_process_artifacts() {
        let store = ProcessStore::default();
        let handle = ResourceHandle::new("process:natural-termination");
        let script = create_owned_script("natural-termination");
        store
            .insert_boxed_with_artifacts(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 41,
                    killed: Arc::new(AtomicBool::new(false)),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
                ProcessArtifacts::owning_file(script.clone()),
            )
            .expect("fake child should be inserted");

        assert!(script.exists());
        assert!(store.remove_finished(&handle));
        assert!(!script.exists());
    }

    #[tokio::test]
    async fn error_only_closed_stream_cleans_the_process_and_owned_artifacts() {
        let store = Arc::new(ProcessStore::default());
        let handle = ResourceHandle::new("process:error-only-closed-stream");
        let script = create_owned_script("error-only-closed-stream");
        let killed = Arc::new(AtomicBool::new(false));
        let waited = Arc::new(AtomicBool::new(false));
        store
            .insert_boxed_with_artifacts(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 42,
                    killed: Arc::clone(&killed),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::clone(&waited),
                }),
                ProcessArtifacts::owning_file(script.clone()),
            )
            .expect("fake process should insert");
        let (error_sender, error_receiver) = channel(1);
        error_sender
            .send(CommandEvent::Error("injected stream error".to_owned()))
            .await
            .expect("stream error should be queued");
        drop(error_sender);
        let cleanup_store = Arc::clone(&store);
        let cleanup_handle = handle.clone();
        let event_handle = handle.clone();
        let emitted_events = Arc::new(Mutex::new(Vec::new()));
        let captured_events = Arc::clone(&emitted_events);
        let event_channel = Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("process events should use JSON channel payloads");
            };
            captured_events
                .lock()
                .expect("captured events should lock")
                .push(serde_json::from_str::<serde_json::Value>(&json)?);
            Ok(())
        });
        forward_events_until_terminated(
            error_receiver,
            handle.clone(),
            Some(event_channel),
            |stream_end, mut terminal_channel| {
                let ProcessStreamEnd::ClosedWithoutTermination { message } = stream_end else {
                    panic!("closed stream should report abnormal completion");
                };
                cleanup_store
                    .finish_failed_stream(&cleanup_handle, message.clone())
                    .map_err(|error| format!("automatic cleanup should kill the child: {error}"))?;
                send_broker_event(
                    &mut terminal_channel,
                    BrokerEvent::Failed {
                        handle: event_handle,
                        message,
                    },
                );
                Ok(())
            },
        )
        .await;

        assert!(killed.load(Ordering::Relaxed));
        assert!(waited.load(Ordering::Relaxed));
        assert!(!store.contains(&handle));
        assert!(!script.exists());
        assert_eq!(
            emitted_events
                .lock()
                .expect("emitted events should lock")
                .iter()
                .map(|event| event["kind"].as_str())
                .collect::<Vec<_>>(),
            vec![Some("error"), Some("failed")]
        );
    }

    #[tokio::test]
    async fn stream_error_waits_for_a_following_terminated_event() {
        let cleanup_calls = Arc::new(AtomicUsize::new(0));
        let (terminated_sender, terminated_receiver) = channel(2);
        terminated_sender
            .send(CommandEvent::Error("injected stream error".to_owned()))
            .await
            .expect("stream error should be queued");
        terminated_sender
            .send(CommandEvent::Terminated(TerminatedPayload {
                code: Some(0),
                signal: None,
            }))
            .await
            .expect("termination should be queued");
        drop(terminated_sender);
        let terminated_cleanup_calls = Arc::clone(&cleanup_calls);
        forward_events_until_terminated(
            terminated_receiver,
            ResourceHandle::new("process:stream-error-then-terminated"),
            None,
            move |stream_end, terminal_channel| {
                assert_eq!(
                    stream_end,
                    ProcessStreamEnd::Terminated {
                        code: Some(0),
                        signal: None,
                    }
                );
                assert!(terminal_channel.is_none());
                terminated_cleanup_calls.fetch_add(1, Ordering::Relaxed);
                Ok(())
            },
        )
        .await;
        assert_eq!(cleanup_calls.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn broker_kill_retry_emits_failed_and_releases_retained_process() {
        let (state, _host, plugin) = state_with_open_plugin("stream-kill-retry");
        let state = Arc::new(state);
        let handle = ResourceHandle::new("process:closed-stream-kill-failure");
        let script = create_owned_script("closed-stream-kill-failure");
        let killed = Arc::new(AtomicBool::new(false));
        let waited = Arc::new(AtomicBool::new(false));
        let emitted_events = Arc::new(Mutex::new(Vec::new()));
        let captured_events = Arc::clone(&emitted_events);
        let terminal_state = Arc::clone(&state);
        let terminal_plugin = plugin.clone();
        let terminal_handle = handle.clone();
        let terminal_script = script.clone();
        let event_channel = Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("process events should use JSON channel payloads");
            };
            let event = serde_json::from_str::<serde_json::Value>(&json)?;
            if event["kind"] == "failed" {
                assert!(!terminal_state.processes.contains(&terminal_handle));
                assert!(!terminal_script.exists());
                assert!(terminal_state
                    .authorizer
                    .lock()
                    .expect("authorizer should lock")
                    .list_resource_handles(&terminal_plugin)
                    .expect("plugin should remain active")
                    .is_empty());
            }
            captured_events
                .lock()
                .expect("captured events should lock")
                .push(event);
            Ok(())
        });
        state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .bind_resource(&plugin, handle.clone())
            .expect("process should bind");
        state
            .processes
            .insert_boxed_with_artifacts_and_events(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 43,
                    killed: Arc::clone(&killed),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(1)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::clone(&waited),
                }),
                ProcessArtifacts::owning_file(script.clone()),
                Some(event_channel.clone()),
            )
            .expect("fake process should insert");
        let (error_sender, error_receiver) = channel(1);
        error_sender
            .send(CommandEvent::Error("injected wait failure".to_owned()))
            .await
            .expect("wait failure should be queued");
        drop(error_sender);
        let cleanup_handle = handle.clone();

        forward_events_until_terminated(
            error_receiver,
            handle.clone(),
            Some(event_channel),
            |stream_end, terminal_channel| {
                super::super::commands::finish_process_resource(
                    &state,
                    &cleanup_handle,
                    stream_end,
                    terminal_channel,
                )
            },
        )
        .await;

        assert!(!killed.load(Ordering::Relaxed));
        assert!(!waited.load(Ordering::Relaxed));
        assert!(state.processes.contains(&handle));
        assert!(script.exists());
        assert_eq!(
            state
                .authorizer
                .lock()
                .expect("authorizer should lock")
                .list_resource_handles(&plugin)
                .expect("plugin should remain active"),
            vec![handle.clone()]
        );

        let response = super::super::commands::kill_process_state(&state, &plugin, &handle)
            .expect("broker kill retry should confirm cleanup");
        assert!(matches!(
            response,
            super::super::commands::BrokerResponse::Unit
        ));
        assert!(killed.load(Ordering::Relaxed));
        assert!(waited.load(Ordering::Relaxed));
        assert!(!state.processes.contains(&handle));
        assert!(!script.exists());
        assert!(state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .list_resource_handles(&plugin)
            .expect("plugin should remain active")
            .is_empty());
        assert_eq!(
            emitted_events
                .lock()
                .expect("emitted events should lock")
                .iter()
                .map(|event| event["kind"].as_str())
                .collect::<Vec<_>>(),
            vec![Some("error"), Some("error"), Some("failed")]
        );
    }

    #[test]
    fn stream_failure_waits_for_concurrent_removal_to_release_ownership() {
        let (state, _host, plugin) = state_with_open_plugin("removal-ordering");
        let state = Arc::new(state);
        let handle = ResourceHandle::new("process:removal-ordering");
        let script = create_owned_script("removal-ordering");
        state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .bind_resource(&plugin, handle.clone())
            .expect("process should bind");
        state
            .processes
            .insert_boxed_with_artifacts(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 44,
                    killed: Arc::new(AtomicBool::new(false)),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
                ProcessArtifacts::owning_file(script.clone()),
            )
            .expect("fake process should insert");
        let emitted_events = Arc::new(Mutex::new(Vec::new()));
        let captured_events = Arc::clone(&emitted_events);
        let observed_state = Arc::clone(&state);
        let observed_plugin = plugin.clone();
        let observed_handle = handle.clone();
        let event_channel = Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("process events should use JSON channel payloads");
            };
            let event = serde_json::from_str::<serde_json::Value>(&json)?;
            if event["kind"] == "failed" {
                assert!(!observed_state.processes.contains(&observed_handle));
                assert!(observed_state
                    .authorizer
                    .lock()
                    .expect("authorizer should lock")
                    .list_resource_handles(&observed_plugin)
                    .expect("plugin should remain active")
                    .is_empty());
            }
            captured_events
                .lock()
                .expect("captured events should lock")
                .push(event);
            Ok(())
        });
        let finalization = state
            .process_finalization
            .lock()
            .expect("process finalization should lock");
        assert!(state
            .processes
            .kill(&handle)
            .expect("process removal should succeed")
            .is_none());
        assert!(!state.processes.contains(&handle));
        assert!(state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .list_resource_handles(&plugin)
            .expect("plugin should remain active")
            .contains(&handle));
        let finalizer_started = Arc::new(Barrier::new(2));
        let finalizer_finished = Arc::new(AtomicBool::new(false));
        let finalizer_state = Arc::clone(&state);
        let finalizer_handle = handle.clone();
        let finalizer_start = Arc::clone(&finalizer_started);
        let finalizer_done = Arc::clone(&finalizer_finished);
        let finalizer = std::thread::spawn(move || {
            finalizer_start.wait();
            super::super::commands::finish_process_resource(
                &finalizer_state,
                &finalizer_handle,
                ProcessStreamEnd::ClosedWithoutTermination {
                    message: "stream ended".to_owned(),
                },
                Some(event_channel),
            )
            .expect("stream finalization should observe confirmed removal");
            finalizer_done.store(true, Ordering::Relaxed);
        });

        finalizer_started.wait();
        assert!(!finalizer_finished.load(Ordering::Relaxed));
        assert!(emitted_events
            .lock()
            .expect("emitted events should lock")
            .is_empty());
        state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .release_resource(&handle);
        drop(finalization);
        finalizer.join().expect("finalizer thread should join");

        assert!(!script.exists());
        assert_eq!(
            emitted_events
                .lock()
                .expect("emitted events should lock")
                .iter()
                .map(|event| event["kind"].as_str())
                .collect::<Vec<_>>(),
            vec![Some("failed")]
        );
    }

    #[test]
    fn broker_kill_retry_waits_until_retention_diagnostic_is_delivered() {
        let (state, _host, plugin) = state_with_open_plugin("diagnostic-ordering");
        let state = Arc::new(state);
        let handle = ResourceHandle::new("process:diagnostic-ordering");
        let script = create_owned_script("diagnostic-ordering");
        let diagnostic_started = Arc::new(Barrier::new(2));
        let diagnostic_release = Arc::new(Barrier::new(2));
        let emitted_events = Arc::new(Mutex::new(Vec::new()));
        let captured_events = Arc::clone(&emitted_events);
        let observed_diagnostic = Arc::clone(&diagnostic_started);
        let release_diagnostic = Arc::clone(&diagnostic_release);
        let event_channel = Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("process events should use JSON channel payloads");
            };
            let event = serde_json::from_str::<serde_json::Value>(&json)?;
            let is_diagnostic = event["kind"] == "error";
            captured_events
                .lock()
                .expect("captured events should lock")
                .push(event);
            if is_diagnostic {
                observed_diagnostic.wait();
                release_diagnostic.wait();
            }
            Ok(())
        });
        state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .bind_resource(&plugin, handle.clone())
            .expect("process should bind");
        state
            .processes
            .insert_boxed_with_artifacts_and_events(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 45,
                    killed: Arc::new(AtomicBool::new(false)),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(1)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
                ProcessArtifacts::owning_file(script.clone()),
                Some(event_channel.clone()),
            )
            .expect("fake process should insert");
        let finalizer_state = Arc::clone(&state);
        let finalizer_handle = handle.clone();
        let finalizer = std::thread::spawn(move || {
            assert!(super::super::commands::finish_process_resource(
                &finalizer_state,
                &finalizer_handle,
                ProcessStreamEnd::ClosedWithoutTermination {
                    message: "wait failed".to_owned(),
                },
                Some(event_channel),
            )
            .is_err());
        });

        diagnostic_started.wait();
        let retry_started = Arc::new(Barrier::new(2));
        let retry_finished = Arc::new(AtomicBool::new(false));
        let retry_state = Arc::clone(&state);
        let retry_plugin = plugin.clone();
        let retry_handle = handle.clone();
        let retry_start = Arc::clone(&retry_started);
        let retry_done = Arc::clone(&retry_finished);
        let retry = std::thread::spawn(move || {
            retry_start.wait();
            super::super::commands::kill_process_state(&retry_state, &retry_plugin, &retry_handle)
                .expect("broker kill retry should succeed");
            retry_done.store(true, Ordering::Relaxed);
        });

        retry_started.wait();
        assert!(!retry_finished.load(Ordering::Relaxed));
        assert_eq!(
            emitted_events
                .lock()
                .expect("emitted events should lock")
                .iter()
                .map(|event| event["kind"].as_str())
                .collect::<Vec<_>>(),
            vec![Some("error")]
        );
        diagnostic_release.wait();
        finalizer.join().expect("finalizer thread should join");
        retry.join().expect("retry thread should join");

        assert!(retry_finished.load(Ordering::Relaxed));
        assert!(!state.processes.contains(&handle));
        assert!(!script.exists());
        assert!(state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .list_resource_handles(&plugin)
            .expect("plugin should remain active")
            .is_empty());
        assert_eq!(
            emitted_events
                .lock()
                .expect("emitted events should lock")
                .iter()
                .map(|event| event["kind"].as_str())
                .collect::<Vec<_>>(),
            vec![Some("error"), Some("failed")]
        );
    }

    #[test]
    fn opaque_handle_controls_only_its_bound_child() {
        let store = ProcessStore::default();
        let killed = Arc::new(AtomicBool::new(false));
        let handle = ResourceHandle::new("process-a");
        store
            .insert_boxed(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 42,
                    killed: Arc::clone(&killed),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
            )
            .expect("fake child should be inserted");

        assert!(store.kill(&ResourceHandle::new("process-b")).is_err());
        assert!(!killed.load(Ordering::Relaxed));
        store.kill(&handle).expect("owner handle should kill");
        assert!(killed.load(Ordering::Relaxed));
    }

    fn opened_plugin() -> (Authorizer, SessionToken, SessionToken) {
        let host = SessionToken::new("host");
        let plugin = SessionToken::new("plugin");
        let mut authorizer = Authorizer::new();
        authorizer
            .bootstrap_host(host.clone(), 1)
            .expect("host should bootstrap");
        authorizer
            .open_plugin(
                &host,
                plugin.clone(),
                Principal::new(
                    "https://plugins.example.test/owner/example",
                    "example.plugin",
                    "1.0.0",
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                ),
            )
            .expect("plugin should open");
        (authorizer, host, plugin)
    }

    #[test]
    fn plugin_revocation_kills_its_in_flight_process_resource() {
        let store = ProcessStore::default();
        let (mut authorizer, host, plugin) = opened_plugin();
        let handle = ResourceHandle::new("process:in-flight");
        let killed = Arc::new(AtomicBool::new(false));
        authorizer
            .bind_resource(&plugin, handle.clone())
            .expect("process should bind to plugin");
        store
            .insert_boxed(
                handle,
                Box::new(FakeChild {
                    pid: 43,
                    killed: Arc::clone(&killed),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
            )
            .expect("fake process should insert");

        let revocation = authorizer
            .revoke_plugin(&host, &plugin)
            .expect("plugin should revoke");
        let cleanup = store.kill_all(&revocation.cleanup_handles);
        assert!(cleanup.failures.is_empty());
        for handle in cleanup.killed {
            authorizer.release_resource(&handle);
        }

        assert!(killed.load(Ordering::Relaxed));
        assert!(authorizer
            .revoke_plugin(&host, &plugin)
            .expect("cleanup state should remain queryable")
            .cleanup_handles
            .is_empty());
    }

    #[test]
    fn failed_kill_does_not_consume_the_authorization_binding() {
        let store = ProcessStore::default();
        let (mut authorizer, _host, plugin) = opened_plugin();
        let handle = ResourceHandle::new("process:kill-failure");
        authorizer
            .bind_resource(&plugin, handle.clone())
            .expect("process should bind");
        let kill_failures_remaining = Arc::new(AtomicUsize::new(1));
        let script = create_owned_script("explicit-kill-retry");
        store
            .insert_boxed_with_artifacts(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 44,
                    killed: Arc::new(AtomicBool::new(false)),
                    kill_failures_remaining,
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
                ProcessArtifacts::owning_file(script.clone()),
            )
            .expect("fake process should insert");

        assert!(store.kill(&handle).is_err());
        assert!(script.exists());
        assert_eq!(
            authorizer
                .list_resource_handles(&plugin)
                .expect("plugin should remain active"),
            vec![handle.clone()]
        );
        store
            .kill(&handle)
            .expect("retained process control should permit a kill retry");
        assert!(!script.exists());
    }

    #[test]
    fn failed_wait_after_kill_retains_control_and_artifacts_for_confirmation_retry() {
        let store = ProcessStore::default();
        let handle = ResourceHandle::new("process:wait-confirmation-failure");
        let script = create_owned_script("wait-confirmation-failure");
        let killed = Arc::new(AtomicBool::new(false));
        let waited = Arc::new(AtomicBool::new(false));
        store
            .insert_boxed_with_artifacts(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 45,
                    killed: Arc::clone(&killed),
                    kill_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(1)),
                    waited: Arc::clone(&waited),
                }),
                ProcessArtifacts::owning_file(script.clone()),
            )
            .expect("fake process should insert");

        assert!(store.kill(&handle).is_err());
        assert!(killed.load(Ordering::Relaxed));
        assert!(waited.load(Ordering::Relaxed));
        assert!(store.contains(&handle));
        assert!(script.exists());

        store
            .kill(&handle)
            .expect("retry should confirm the already-exited child");
        assert!(!store.contains(&handle));
        assert!(!script.exists());
    }

    fn state_with_open_plugin(
        name: &str,
    ) -> (super::super::BrokerState, SessionToken, SessionToken) {
        let state = super::super::BrokerState::new(
            std::env::temp_dir()
                .join(format!(
                    "kaede-process-cleanup-{name}-{}",
                    std::process::id()
                ))
                .join("decisions.json"),
        )
        .expect("broker state should initialize");
        let host = SessionToken::new(format!("{name}-host"));
        let plugin = SessionToken::new(format!("{name}-plugin"));
        {
            let mut authorizer = state.authorizer.lock().expect("authorizer should lock");
            authorizer
                .bootstrap_host(host.clone(), 1)
                .expect("host should bootstrap");
            authorizer
                .open_plugin(
                    &host,
                    plugin.clone(),
                    Principal::new(
                        "https://plugins.example.test/owner/example",
                        "example.plugin",
                        "1.0.0",
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    ),
                )
                .expect("plugin should open");
        }
        state.operations.register(plugin.clone());
        (state, host, plugin)
    }

    fn insert_failing_child(
        state: &super::super::BrokerState,
        owner: &SessionToken,
        handle: &ResourceHandle,
        failures: usize,
    ) -> (Arc<AtomicBool>, Arc<AtomicUsize>, PathBuf) {
        let killed = Arc::new(AtomicBool::new(false));
        let failures_remaining = Arc::new(AtomicUsize::new(failures));
        let script = create_owned_script(handle.as_str());
        state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .bind_resource(owner, handle.clone())
            .expect("process should bind");
        state
            .processes
            .insert_boxed_with_artifacts(
                handle.clone(),
                Box::new(FakeChild {
                    pid: 45,
                    killed: Arc::clone(&killed),
                    kill_failures_remaining: Arc::clone(&failures_remaining),
                    wait_failures_remaining: Arc::new(AtomicUsize::new(0)),
                    waited: Arc::new(AtomicBool::new(false)),
                }),
                ProcessArtifacts::owning_file(script.clone()),
            )
            .expect("fake process should insert");
        (killed, failures_remaining, script)
    }

    #[tokio::test]
    async fn revoke_cleanup_retries_a_transient_kill_and_releases_ownership() {
        let (state, host, plugin) = state_with_open_plugin("transient-revoke");
        let handle = ResourceHandle::new("process:transient-revoke");
        let (killed, failures_remaining, script) =
            insert_failing_child(&state, &plugin, &handle, 1);

        let response = super::super::commands::revoke_plugin_state(&state, &host, &plugin)
            .await
            .expect("the retry should contain a transient kill failure");

        assert!(matches!(
            response,
            super::super::commands::BrokerResponse::PluginRevoked {
                already_revoked: false
            }
        ));
        assert_eq!(failures_remaining.load(Ordering::Relaxed), 0);
        assert!(killed.load(Ordering::Relaxed));
        assert!(!state.processes.contains(&handle));
        assert!(!script.exists());
        assert!(state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .revoke_plugin(&host, &plugin)
            .expect("repeat revoke should succeed")
            .cleanup_handles
            .is_empty());
    }

    #[tokio::test]
    async fn persistent_revoke_kill_failure_retains_process_and_binding_for_a_later_retry() {
        let (state, host, plugin) = state_with_open_plugin("persistent-revoke");
        let handle = ResourceHandle::new("process:persistent-revoke");
        let (killed, failures_remaining, script) =
            insert_failing_child(&state, &plugin, &handle, 2);

        let error = super::super::commands::revoke_plugin_state(&state, &host, &plugin)
            .await
            .expect_err("explicit revoke must fail when both kill attempts fail");
        assert!(matches!(
            error,
            super::super::commands::CommandError::OperationFailed {
                operation: "revoke_plugin_processes",
                ref message,
            } if message.contains(handle.as_str())
        ));
        assert_eq!(failures_remaining.load(Ordering::Relaxed), 0);
        assert!(!killed.load(Ordering::Relaxed));
        assert!(state.processes.contains(&handle));
        assert!(script.exists());

        let response = super::super::commands::revoke_plugin_state(&state, &host, &plugin)
            .await
            .expect("a later revoke should retry termination");
        assert!(matches!(
            response,
            super::super::commands::BrokerResponse::PluginRevoked {
                already_revoked: true
            }
        ));
        assert!(killed.load(Ordering::Relaxed));
        assert!(!state.processes.contains(&handle));
        assert!(!script.exists());
        assert!(state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .revoke_plugin(&host, &plugin)
            .expect("final revoke should observe completed cleanup")
            .cleanup_handles
            .is_empty());
    }

    #[test]
    fn page_reset_retains_failed_cleanup_for_the_next_reset() {
        let (state, _host, plugin) = state_with_open_plugin("persistent-reset");
        let handle = ResourceHandle::new("process:persistent-reset");
        let (killed, failures_remaining, script) =
            insert_failing_child(&state, &plugin, &handle, 2);

        super::super::reset_state_for_page_load(&state);

        assert_eq!(failures_remaining.load(Ordering::Relaxed), 0);
        assert!(!killed.load(Ordering::Relaxed));
        assert!(state.processes.contains(&handle));
        assert!(script.exists());

        super::super::reset_state_for_page_load(&state);

        assert!(killed.load(Ordering::Relaxed));
        assert!(!state.processes.contains(&handle));
        assert!(!script.exists());
        assert!(state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .release_resource(&handle)
            .is_none());
    }
}
