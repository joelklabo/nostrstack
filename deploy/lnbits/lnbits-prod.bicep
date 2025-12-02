param name string = 'lnbits-prod-west'
param location string = 'westus3'
param envId string
param acrServer string
param acrUsername string
@secure()
param acrPassword string
@secure()
param dbUrlSecret string
@secure()
param dbUrlPrismaSecret string
@secure()
param lndEndpointSecret string
@secure()
param lndMacHexSecret string
@secure()
param lndTlsSecret string

@allowed([
  'signet'
  'mainnet'
])
param network string = 'signet'

param imageTag string = 'stg'
param rev string = '20251202a'

resource ca 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: envId
    configuration: {
      ingress: {
        external: true
        targetPort: 5000
        transport: 'Auto'
      }
      registries: [
        {
          server: acrServer
          username: acrUsername
          passwordSecretRef: 'acr-pw'
        }
      ]
      secrets: [
        {
          name: 'acr-pw'
          value: acrPassword
        }
        {
          name: 'lnbits-prod-database-url'
          keyVaultUrl: dbUrlSecret
          identity: 'system'
        }
        {
          name: 'database-url-prod'
          keyVaultUrl: dbUrlPrismaSecret
          identity: 'system'
        }
        {
          name: 'lnd-mainnet-endpoint'
          keyVaultUrl: lndEndpointSecret
          identity: 'system'
        }
        {
          name: 'lnd-mainnet-macaroon-hex'
          keyVaultUrl: lndMacHexSecret
          identity: 'system'
        }
        {
          name: 'lnd-mainnet-tls'
          keyVaultUrl: lndTlsSecret
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'lnbits-prod'
          image: '${acrServer}/lnbits:${imageTag}'
          env: [
            { name: 'LNBITS_BACKEND_WALLET_CLASS', value: 'LndWallet' }
            { name: 'LNBITS_FUNDING_SOURCE', value: 'LndWallet' }
            { name: 'LNBITS_SITE_TITLE', value: 'nostrstack LNbits (prod)' }
            { name: 'LNBITS_ADMIN_UI', value: 'true' }
            { name: 'LNBITS_DATA_FOLDER', value: '/data' }
            { name: 'LNBITS_DATABASE_URL', secretRef: 'lnbits-prod-database-url' }
            { name: 'DATABASE_URL', secretRef: 'database-url-prod' }
            { name: 'LND_GRPC_ENDPOINT', secretRef: 'lnd-mainnet-endpoint' }
            { name: 'LND_GRPC_MACAROON', secretRef: 'lnd-mainnet-macaroon-hex' }
            { name: 'LND_GRPC_ADMIN_MACAROON', secretRef: 'lnd-mainnet-macaroon-hex' }
            { name: 'LND_GRPC_CERT', secretRef: 'lnd-mainnet-tls' }
            { name: 'LND_GRPC_PORT', value: '10009' }
            { name: 'LND_NETWORK', value: network }
            { name: 'LNBITS_REV', value: rev }
            { name: 'PGHOST', value: 'nostrstack-pg-west.postgres.database.azure.com' }
          ]
          resources: {
            cpu: 1
            memory: '2Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}
