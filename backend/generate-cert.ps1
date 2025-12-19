# Generate self-signed SSL certificate for HTTPS
Write-Host "Generating SSL Certificate..." -ForegroundColor Green

# Create certificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "10.237.19.96" `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddYears(10) `
    -FriendlyName "LibrarySystemSSL" `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")

# Export certificate
$certPath = "$PSScriptRoot\localhost.pfx"
$certPassword = ConvertTo-SecureString -String "library123" -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $certPassword

Write-Host "`nCertificate generated successfully!" -ForegroundColor Green
Write-Host "Location: $certPath" -ForegroundColor Cyan
Write-Host "Password: library123" -ForegroundColor Cyan
Write-Host "`nNow run: node server-https.js" -ForegroundColor Yellow
