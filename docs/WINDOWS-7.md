# Launching Kaede in Windows 7

## Prerequisites

This guide is written for Windows 7, but Kaede itself was tested only in Windows 7 x64 Ultimate Service Pack 1 (build 7601).

Install these necessary updates and runtimes:

- [KB3080149](https://www.microsoft.com/en-us/download/details.aspx?id=48636)
- [Microsoft Visual C++ 2015 Redistributable (x86 and x64)](https://www.microsoft.com/en-us/download/details.aspx?id=52685)
- [Microsoft Visual C++ 2015-2022 Redistributable (x86)](https://aka.ms/vs/17/release/vc_redist.x86.exe)
- [Microsoft Visual C++ 2015-2022 Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe)

I have also installed these updates, but they shouldn't be necessary:

- [KB2882822](https://www.microsoft.com/en-us/download/details.aspx?id=40500)
- [KB3033929](https://www.microsoft.com/en-us/download/details.aspx?id=46148)
- [Visual C++ Redistributable Runtimes All-in-One 2005-2013 (both x86 and x64)](https://www.techpowerup.com/download/visual-c-redistributable-runtime-package-all-in-one/). Run `install_all.bat`. I had errors for `vcredist_v14.x64` and `vcredist_v14.x86`

> `ADVAPI32.dll`

- Make sure you have installed the `KB3080149` update.

> `MSVCP140.dll`

- Make sure you have installed Microsoft Visual C++ 2015 Redistributable (both x86 and x64).

> `MSVCP140_1.dll`

- Make sure you have installed Microsoft Visual C++ 2015-2022 Redistributable (both x86 and x64)

## Running

Please use Windows 7-specific build only. Otherwise, you won't be able to execute the launcher.

After extracting the build files (`kaede.exe`, `portable.txt`, and `txiki-server.exe`) into a folder, simply open `kaede.exe`. You should see a launcher window with no errors.
