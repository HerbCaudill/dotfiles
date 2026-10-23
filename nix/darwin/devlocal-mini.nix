{ lib, pkgs, username, ... }:
let
  homeDirectory = "/Users/${username}";
  tunnel = pkgs.writeShellScript "devlocal-mini-tunnel" ''
    /sbin/ifconfig lo0 alias 127.0.0.2 up
    exec /usr/bin/ssh -NT \
      -F /dev/null -l herb \
      -o "IdentityFile=${homeDirectory}/.ssh/id_ed25519" \
      -o "UserKnownHostsFile=${homeDirectory}/.ssh/known_hosts" \
      -o BatchMode=yes -o ExitOnForwardFailure=yes \
      -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -L 127.0.0.2:80:127.0.0.1:80 \
      -L 127.0.0.2:443:127.0.0.1:8443 mini
  '';
in
{
  # Keep DevResults separate from the HTTPS router on 127.0.0.1.
  services.dnsmasq = {
    enable = true;
    bind = "127.0.0.1";
    port = 5354;
    addresses."devlocal.us" = "127.0.0.2";
  };
  environment.etc."resolver/devlocal.us".text = ''
    nameserver 127.0.0.1
    port 5354
  '';
  system.activationScripts.postActivation.text = lib.mkAfter ''
    # Replace the old Parallels overrides without changing its other hostnames.
    /usr/bin/sed -i "" -E '/devlocal\.us/s/^10\.211\.55\.3/127.0.0.2/' /etc/hosts
    /usr/bin/dscacheutil -flushcache
    /usr/bin/killall -HUP mDNSResponder || true
  '';
  launchd.daemons."devlocal-mini-tunnel".serviceConfig = {
    Label = "com.herbcaudill.devlocal-mini-tunnel";
    ProgramArguments = [ "${tunnel}" ];
    RunAtLoad = true;
    KeepAlive = true;
    ThrottleInterval = 10;
    StandardOutPath = "/var/log/devlocal-mini-tunnel.log";
    StandardErrorPath = "/var/log/devlocal-mini-tunnel.log";
  };
}
