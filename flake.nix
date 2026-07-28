{
  description = "Kaede";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-darwin-x86.url = "github:NixOS/nixpkgs/nixpkgs-26.05-darwin";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = {
    self,
    nixpkgs,
    nixpkgs-darwin-x86,
    flake-utils,
    rust-overlay,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        selectedNixpkgs =
          if system == "x86_64-darwin"
          then nixpkgs-darwin-x86
          else nixpkgs;
        pkgs = import selectedNixpkgs {
          inherit system;
          overlays = [rust-overlay.overlays.default];
        };

        bunSources = {
          aarch64-darwin = pkgs.fetchurl {
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-darwin-aarch64.zip";
            hash = "sha256-2LliIYKK1vl6x6wKt+lYcjQa92MAHogD6CZ2UsJlJiA=";
          };
          x86_64-darwin = pkgs.fetchurl {
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-darwin-x64.zip";
            hash = "sha256-QYPfM3RiPlurMVxUfPoJdFM81FfYa3O2OfeoeXTNZjM=";
          };
          aarch64-linux = pkgs.fetchurl {
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-aarch64.zip";
            hash = "sha256-on/7Y6gxA3WDbg1vZorhf6jY0YuIw3yCHGUzGXOhmjs=";
          };
          x86_64-linux = pkgs.fetchurl {
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64.zip";
            hash = "sha256-lR7iruhV8IWVruxiJSJqKY0/6oOj3NZGXAnLzN9+hI8=";
          };
        };

        bunCurrent = pkgs.bun.overrideAttrs (_finalAttrs: previousAttrs: {
          version = "1.3.14";
          src = bunSources.${system};
          sourceRoot = {
            aarch64-darwin = "bun-darwin-aarch64";
            x86_64-darwin = "bun-darwin-x64";
            aarch64-linux = "bun-linux-aarch64";
            x86_64-linux = "bun-linux-x64";
          }.${system};
          passthru = previousAttrs.passthru // {sources = bunSources;};
          meta = previousAttrs.meta // {platforms = builtins.attrNames bunSources;};
        });

        webDependencies = with pkgs;
          [openssl_3]
          ++ lib.optionals stdenv.isLinux [
            webkitgtk_4_1
            glib
            gsettings-desktop-schemas
            dbus
            cairo
            gdk-pixbuf
            libayatana-appindicator
          ];

        nativeDependencies = with pkgs;
          [
            rust-bin.stable."1.97.1".default
            nodejs_26
            bunCurrent
            cargo-tauri
            pkg-config
            curl
            cmake
            llvmPackages.libllvm
            llvmPackages.lld
            llvmPackages.clang
          ]
          ++ lib.optionals stdenv.isLinux [wrapGAppsHook3];

        cargoLinkerVariable =
          {
            aarch64-linux = "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER";
            x86_64-linux = "CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER";
          }.${system} or null;
      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = nativeDependencies;
          buildInputs = webDependencies;

          shellHook = ''
            echo "🐢 Say hi to kaede nix devShell"
            ${pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              export ${cargoLinkerVariable}=clang
            ''}
          '';
        };
      }
    );
}
