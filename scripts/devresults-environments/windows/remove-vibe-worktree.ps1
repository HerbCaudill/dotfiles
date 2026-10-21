param([string]$RequestPath)
$ErrorActionPreference='Stop'
try {
    $m=Get-Content -LiteralPath $RequestPath -Raw|ConvertFrom-Json
    $path=[IO.Path]::GetFullPath([string]$m.vibe.path)
    $root=Split-Path (Split-Path $m.paths.runtime)
    if($path -cne (Join-Path $root "vibe\$($m.id)")){throw 'Foreign worktree path'}
    $control="$path.drenv-source"
    foreach($target in @($path,$control)) {
        $current=$target
        while($current) {
            if((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Foreign worktree ancestor'}
            $parent=Split-Path $current
            if($parent -eq $current){break};$current=$parent
        }
    }
    $owner=Get-Content -LiteralPath (Join-Path $control 'owner.json') -Raw|ConvertFrom-Json
    if($owner.environmentId -cne $m.id -or $owner.ownerToken -cne $m.ownerToken -or $owner.path -cne $path){throw 'Foreign worktree owner'}
    $repository=Join-Path $control 'repository.git'
    $common=((& git -C $path rev-parse --path-format=absolute --git-common-dir)-join '').Trim()
    if($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($common) -ine $repository){throw 'Foreign worktree Git store'}
    if(((& git -C $path status --porcelain --untracked-files=all)-join '') -or $LASTEXITCODE -ne 0){throw 'Dirty worktree'}
    # Git for Windows can follow junctions; unlink them before deleting the owned tree.
    $pending=[Collections.Generic.Stack[string]]::new()
    $pending.Push($path)
    while($pending.Count) {
        $directory=[IO.DirectoryInfo]::new($pending.Pop())
        if($directory.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Worktree directory changed to a junction'}
        foreach($entry in $directory.EnumerateFileSystemInfos()) {
            if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                if($entry.Attributes -band [IO.FileAttributes]::Directory){[IO.Directory]::Delete($entry.FullName,$false)}else{[IO.File]::Delete($entry.FullName)}
            } elseif($entry.Attributes -band [IO.FileAttributes]::Directory){$pending.Push($entry.FullName)}
        }
    }
    & git -c core.longpaths=true -C $repository worktree remove --force -- $path 2>$null
    if($LASTEXITCODE -ne 0){throw 'Git worktree removal failed'}
} catch {Write-Error 'Owned VibeResults worktree cleanup failed; ownership and remaining files were preserved';exit 1}
