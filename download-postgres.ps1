$url = 'https://get.enterprisedb.com/postgresql/postgresql-16.16-1-windows-x64.exe'
$out = 'F:\PostgreSQL\16\postgresql-16.16-windows-x64.exe'
New-Item -ItemType Directory -Path 'F:\PostgreSQL\16' -Force | Out-Null
Write-Host "Downloading PostgreSQL 16.16 to $out ..."
$wc = New-Object System.Net.WebClient
$wc.DownloadFile($url, $out)
$fi = Get-Item $out
Write-Host ("Downloaded: " + $fi.Length + " bytes")
Write-Host ("Path: " + $fi.FullName)
