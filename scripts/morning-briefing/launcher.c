/*
 * Stable launcher for the morning briefing LaunchAgent.
 *
 * macOS grants Full Disk Access to the job's responsible process. The pipeline runs under Node
 * from the Nix store, whose code signature changes with every update, so the grant would keep
 * disappearing. This launcher is compiled once outside the store and spawns the pipeline as a
 * child, which inherits the launcher's grant. That lets the briefing read Messages' chat.db.
 */

#include <errno.h>
#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

extern char **environ;

int main(int argc, char *argv[]) {
  const char *home = getenv("HOME");
  if (!home) {
    fprintf(stderr, "morning-briefing-launcher: HOME is not set\n");
    return 1;
  }

  char path[1024];
  snprintf(path, sizeof path, "%s/.local/bin/morning-briefing", home);
  argv[0] = path;

  pid_t pid;
  int error = posix_spawn(&pid, path, NULL, NULL, argv, environ);
  if (error) {
    fprintf(stderr, "morning-briefing-launcher: cannot start %s: %s\n", path, strerror(error));
    return 1;
  }

  int status;
  while (waitpid(pid, &status, 0) < 0)
    if (errno != EINTR) {
      perror("morning-briefing-launcher: waitpid");
      return 1;
    }
  return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}
