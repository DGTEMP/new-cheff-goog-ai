$cert = New-SelfSignedCertificate -DnsName 'localhost', '127.0.0.1' -CertStoreLocation 'cert:\CurrentUser\My'
Export-PfxCertificate -Cert $cert -FilePath '.\installer\cert.pfx' -Password (ConvertTo-SecureString -String 'chef' -Force -AsPlainText)
