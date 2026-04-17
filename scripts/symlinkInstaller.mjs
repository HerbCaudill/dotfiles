/** Shared deprecation message for the removed symlink installer. */
export const DEPRECATION_MESSAGE = [
  "The symlink installer was removed in the Nix cutover.",
  "Apply this repo with nix-darwin instead:",
  "  nix run github:LnL7/nix-darwin/master#darwin-rebuild -- switch --flake ~/Code/HerbCaudill/dotfiles#herbcaudill",
].join("\n")

/** Throw the hard-cutover error for the removed installer. */
export const installDotfiles = (
  /** The removed installer options. */
  _options = {},
) => {
  throw new Error(DEPRECATION_MESSAGE)
}
