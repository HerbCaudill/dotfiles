{ fullName, email, username, ... }:
{
  programs.git = {
    enable = true;
    ignores = [
      ".DS_Store"
      ".ralph/*.jsonl"
    ];
    settings = {
      user.name = fullName;
      user.email = email;
      init.defaultBranch = "main";
      pull.rebase = true;
      advice.detachedHead = false;
      url."https://github.com/".insteadOf = "git@github.com:";
      rerere = {
        enabled = true;
        autoupdate = true;
      };
      credential = {
        helper = "osxkeychain";
        "https://github.com".helper = [
          ""
          "!gh auth git-credential"
        ];
      };
      safe.directory = [
        "/Users/${username}"
        "/Users/${username}/Code/HerbCaudill"
        "/Users/${username}/Code/HerbCaudill/briefings"
        "/Users/${username}/Desktop/dev environment"
      ];
    };
  };
}
