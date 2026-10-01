{
  lib,
  stdenvNoCC,
  fetchurl,
  makeWrapper,
  nodejs_24,
  openssl,
  git,
}:
stdenvNoCC.mkDerivation {
  pname = "portless";
  version = "0.15.6";
  src = fetchurl {
    url = "https://registry.npmjs.org/portless/-/portless-0.15.6.tgz";
    hash = "sha256-SPFeXWPEd4RTTdletSAefmWM5D6uG3q5YNNLbWe5VIo=";
  };
  nativeBuildInputs = [ makeWrapper ];
  dontBuild = true;
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/lib/portless" "$out/bin"
    cp -r dist package.json "$out/lib/portless/"
    makeWrapper ${nodejs_24}/bin/node "$out/bin/portless" \
      --add-flags "$out/lib/portless/dist/cli.js" \
      --prefix PATH : ${
        lib.makeBinPath [
          openssl
          git
        ]
      }
    runHook postInstall
  '';
  meta = {
    description = "Named localhost routing with automatic application ports";
    homepage = "https://github.com/vercel-labs/portless";
    license = lib.licenses.asl20;
    platforms = lib.platforms.darwin;
    mainProgram = "portless";
  };
}
