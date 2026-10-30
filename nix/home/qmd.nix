{ config, pkgs, ... }:
{
  launchd.agents.qmd-refresh = {
    enable = true;
    config = {
      Label = "com.herbcaudill.qmd-refresh";
      ProgramArguments = [
        "${pkgs.nodejs_24}/bin/node"
        "--experimental-strip-types"
        "${config.home.homeDirectory}/Code/HerbCaudill/dotfiles/scripts/qmd/refresh.ts"
      ];
      StartCalendarInterval = { Hour = 9; Minute = 0; };
      RunAtLoad = true;
      # Background process policy can stall Metal shader initialization.
      ProcessType = "Standard";
      LowPriorityIO = true;
      Nice = 10;
      StandardOutPath = "/tmp/qmd-refresh.log";
      StandardErrorPath = "/tmp/qmd-refresh.log";
      EnvironmentVariables.PATH = "${pkgs.nodejs_24}/bin:/usr/bin:/bin:/usr/sbin:/sbin";
    };
  };
  home.file.".config/qmd/index.yml".text = ''
    collections:
      notes:
        path: ${builtins.toJSON "${config.home.homeDirectory}/Code/HerbCaudill/notes"}
        pattern: "**/*.md"
        context:
          "": "Herb Caudill's personal Obsidian wiki: ideas, reference notes, daily notes and meeting transcripts."
    models:
      embed: hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf
      generate: hf:tobil/qmd-query-expansion-1.7B-gguf/qmd-query-expansion-1.7B-q4_k_m.gguf
      rerank: hf:ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF/qwen3-reranker-0.6b-q8_0.gguf
  '';
}
