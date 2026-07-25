import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.Arrays;
import java.util.logging.Logger;

import static java.util.logging.Level.INFO;
import static java.util.logging.Level.SEVERE;

public class Main {
    public static void main(String[] args) {
        Logger logger = Logger.getLogger("launcher.main");

        try {
            String[] commandArguments = Arrays.copyOfRange(args, 1, args.length);
            String workingDirectory = args[0];

            logger.log(
                    INFO,
                    "Kaede Launcher. Working directory: " +
                            workingDirectory
            );
            logger.log(
                    INFO,
                    "__java_applet_pid_workaround_" + getProcessId("your-JVM-is-limited")
            );

            ProcessBuilder processBuilder = new ProcessBuilder(commandArguments)
                    .inheritIO()
                    .directory(new File(workingDirectory));

            processBuilder
                    .start()
                    .waitFor();
        } catch (Exception exception) {
            logger.log(SEVERE, "Error: " + exception.getMessage());
        }
    }

    // Source - https://stackoverflow.com/a/7690178
    // Posted by Martin
    // Retrieved 2026-01-11, License - CC BY-SA 3.0
    private static String getProcessId(final String fallback) {
        // Note: may fail in some JVM implementations
        // therefore fallback has to be provided

        // something like '<pid>@<hostname>', at least in SUN / Oracle JVMs
        final String jvmName = ManagementFactory.getRuntimeMXBean().getName();
        final int index = jvmName.indexOf('@');

        if (index < 1) {
            // part before '@' empty (index = 0) / '@' not found (index = -1)
            return fallback;
        }

        try {
            return Long.toString(Long.parseLong(jvmName.substring(0, index)));
        } catch (NumberFormatException e) {
            // ignore
        }
        return fallback;
    }

}
