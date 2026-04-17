{ fullName, email, username, ... }:
{
  programs.git = {
    enable = true;
    userName = fullName;
    userEmail = email;
    ignores = [
      ".DS_Store"
      ".ralph/*.jsonl"
    ];
    extraConfig = {
      init.defaultBranch = "main";
      pull.rebase = true;
      advice.detachedHead = false;
      url."https://github.com/".insteadOf = "git@github.com:";
      rerere = {
        enabled = true;
        autoupdate = true;
      };
      credential.helper = "osxkeychain";
      safe.directory = [
        "/Users/${username}"
        "/Users/${username}/Code/HerbCaudill"
        "/Users/${username}/Code/HerbCaudill/briefings"
        "/Users/${username}/Desktop/dev environment"
      ];
    };
  };
}
