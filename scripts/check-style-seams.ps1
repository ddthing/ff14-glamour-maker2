$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$styleFiles = @(
  "styles/tokens.css",
  "styles.css",
  "styles/card-composer.css",
  "styles/editor-controls.css",
  "styles/card-readability.css"
)

foreach ($relativePath in $styleFiles) {
  $path = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing stylesheet: $relativePath"
  }

  $source = Get-Content -Raw -LiteralPath $path
  $openBraces = ([regex]::Matches($source, "\{")).Count
  $closeBraces = ([regex]::Matches($source, "\}")).Count
  if ($openBraces -ne $closeBraces) {
    throw "Unbalanced braces in ${relativePath}: $openBraces open, $closeBraces close"
  }
}

$editorSource = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "styles/editor-controls.css")
$cardOnlySelectors = @(".canvas-board", ".board-", ".portrait-wrap", ".character-figure")
foreach ($selector in $cardOnlySelectors) {
  if ($editorSource.Contains($selector)) {
    throw "Editor controls crossed into the card seam: $selector"
  }
}

$cardSource = @(
  Get-Content -Raw -LiteralPath (Join-Path $projectRoot "styles/card-composer.css")
  Get-Content -Raw -LiteralPath (Join-Path $projectRoot "styles/card-readability.css")
) -join "`n"
$editorOnlySelectors = @(".inspector", ".topbar", ".library-sidebar", ".title-weight-option", ".portrait-section")
foreach ($selector in $editorOnlySelectors) {
  if ($cardSource.Contains($selector)) {
    throw "Card styles crossed into the editor seam: $selector"
  }
}

$html = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "index.html")
$expectedOrder = @("styles/tokens.css", "styles.css", "styles/card-composer.css", "styles/editor-controls.css", "styles/card-readability.css")
$lastIndex = -1
foreach ($stylesheet in $expectedOrder) {
  $currentIndex = $html.IndexOf($stylesheet)
  if ($currentIndex -lt 0 -or $currentIndex -le $lastIndex) {
    throw "Stylesheet loading order is invalid near: $stylesheet"
  }
  $lastIndex = $currentIndex
}

Write-Output "Style seams valid: shared tokens -> core -> card composition -> editor controls -> card readability"
