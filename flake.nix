{
  description = "Herb Caudill's macOS environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    darwin = {
      url = "github:LnL7/nix-darwin";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{
    self,
    nixpkgs,
    darwin,
    home-manager,
    ...
  }:
    let
      system = "aarch64-darwin";
      username = "herbcaudill";
      fullName = "Herb Caudill";
      email = "herb@devresults.com";
      dotfilesRoot = "/Users/${username}/Code/HerbCaudill/dotfiles";
      specialArgs = {
        inherit inputs self username fullName email dotfilesRoot;
      };
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      formatter.${system} = pkgs.nixfmt-rfc-style;

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          git
          nixfmt-rfc-style
          nodejs_24
          pnpm
        ];
      };

      darwinConfigurations.${username} = darwin.lib.darwinSystem {
        inherit system specialArgs;
        modules = [
          ./nix/darwin/default.nix
          home-manager.darwinModules.home-manager
          {
            nixpkgs.hostPlatform = system;
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.extraSpecialArgs = specialArgs;
            home-manager.users.${username} = import ./nix/home/default.nix;
          }
        ];
      };
    };
}
