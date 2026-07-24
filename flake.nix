{
  description = "Kaede";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    rust-overlay,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [rust-overlay.overlays.default];
        };

        webDependencies = with pkgs; [
          webkitgtk_4_1
          glib
          gsettings-desktop-schemas
          dbus
          openssl_3
          cairo
          gdk-pixbuf
          libayatana-appindicator
        ];

        nativeDependencies = with pkgs; [
          rust-bin.beta.latest.default
          nodejs
          bun
          cargo-tauri
          pkg-config
          curl
          cmake
          wrapGAppsHook3
          llvmPackages.libllvm
          llvmPackages.lld
          llvmPackages.clang
        ];
      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = nativeDependencies;
          buildInputs = webDependencies;

          shellHook = ''
            echo "🐢 Say hi to kaede nix devShell"
          '';
        };
      }
    );
}
