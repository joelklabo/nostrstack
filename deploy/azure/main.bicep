param location string = resourceGroup().location
param containerImage string
@secure()
param adminApiKey string
@secure()
param opNodeApiKey string
@secure()
param opNodeWebhookSecret string
param postgresSku string = 'Standard_B1ms'
param postgresStorageGb int = 32
param appName string = 'nostrstack-api'
param envName string = 'nostrstack-env'
param kvName string = 'nostrstack-kv'
param pgName string = 'nostrstack-pg'
param registryServer string = ''
param registryUsername string = ''
@secure()
param registryPassword string = ''
@secure()
param lnbitsUrl string = ''
@secure()
param lnbitsApiKey string = ''
param otelEnabled bool = false
param otelEndpoint string = ''
@secure()
param otelHeaders string = ''
param logAnalyticsWorkspaceId string = ''
@secure()
param logAnalyticsSharedKey string = ''
param deployerObjectId string = ''
param enableWorkloadProfiles bool = false

var useRegistry = !empty(registryServer)
var useOtel = otelEnabled && !empty(otelEndpoint)
var useLogAnalytics = !empty(logAnalyticsWorkspaceId) && !empty(logAnalyticsSharedKey)

// Only include workload profiles when explicitly enabled (for new environments)
var baseEnvProps = useLogAnalytics ? {
  appLogsConfiguration: {
    destination: 'log-analytics'
    logAnalyticsConfiguration: {
      customerId: logAnalyticsWorkspaceId
      sharedKey: logAnalyticsSharedKey
    }
  }
} : {}

var envProps = enableWorkloadProfiles ? union(baseEnvProps, {
  workloadProfiles: [
    {
      name: 'Consumption'
      workloadProfileType: 'Consumption'
    }
  ]
}) : baseEnvProps

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    accessPolicies: !empty(deployerObjectId) ? [
      {
        objectId: deployerObjectId
        tenantId: subscription().tenantId
        permissions: {
          secrets: ['get', 'list', 'set', 'delete']
        }
      }
    ] : []
    enableSoftDelete: true
    enabledForDeployment: true
  }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgName
  location: location
  properties: {
    administratorLogin: 'nostrstack'
    administratorLoginPassword: adminApiKey
    version: '15'
    storage: { storageSizeGB: postgresStorageGb }
    network: { delegatedSubnetResourceId: null, publicNetworkAccess: 'Enabled' }
  }
  sku: {
    name: postgresSku
    tier: 'Burstable'
  }
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  name: 'nostrstack'
  parent: pg
  properties: {}
}

var dbUrl = 'postgresql://nostrstack:${adminApiKey}@${pg.name}.postgres.database.azure.com:5432/nostrstack'

resource secretDb 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'database-url'
  properties: { value: dbUrl }
}
resource secretAdmin 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'admin-api-key'
  properties: { value: adminApiKey }
}
resource secretOp 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'op-node-api-key'
  properties: { value: opNodeApiKey }
}
resource secretWebhook 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'op-node-webhook-secret'
  properties: { value: opNodeWebhookSecret }
}

resource secretRegistry 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (useRegistry) {
  parent: kv
  name: 'registry-password'
  properties: { value: registryPassword }
}

resource secretOtelHeaders 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (useOtel && !empty(otelHeaders)) {
  parent: kv
  name: 'otel-exporter-otlp-headers'
  properties: { value: otelHeaders }
}

resource secretLnbitsUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(lnbitsUrl)) {
  parent: kv
  name: 'lnbits-url'
  properties: { value: lnbitsUrl }
}

resource secretLnbitsApiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(lnbitsApiKey)) {
  parent: kv
  name: 'lnbits-api-key'
  properties: { value: lnbitsApiKey }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: envProps
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
      }
      secrets: concat(
        [
          { name: 'database-url', value: dbUrl }
          { name: 'admin-api-key', value: adminApiKey }
          { name: 'op-node-api-key', value: opNodeApiKey }
          { name: 'op-node-webhook-secret', value: opNodeWebhookSecret }
        ],
        useRegistry ? [ { name: 'registry-password', value: registryPassword } ] : [],
        (useOtel && !empty(otelHeaders)) ? [ { name: 'otel-headers', value: otelHeaders } ] : [],
        (!empty(lnbitsUrl)) ? [ { name: 'lnbits-url', value: lnbitsUrl } ] : [],
        (!empty(lnbitsApiKey)) ? [ { name: 'lnbits-api-key', value: lnbitsApiKey } ] : []
      )
      registries: useRegistry ? [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          env: concat(
            [
              { name: 'DATABASE_URL', secretRef: 'database-url' }
              { name: 'ADMIN_API_KEY', secretRef: 'admin-api-key' }
              { name: 'OP_NODE_API_KEY', secretRef: 'op-node-api-key' }
              { name: 'OP_NODE_WEBHOOK_SECRET', secretRef: 'op-node-webhook-secret' }
              { name: 'PUBLIC_ORIGIN', value: 'https://api.nostrstack.com' }
              { name: 'CORS_ALLOWED_ORIGINS', value: 'https://nostrstack.com,https://api.nostrstack.com' }
              { name: 'NODE_ENV', value: 'production' }
              { name: 'LOG_LEVEL', value: 'info' }
              { name: 'OTEL_ENABLED', value: string(otelEnabled) }
              { name: 'TELEMETRY_PROVIDER', value: 'esplora' }
              { name: 'TELEMETRY_ESPLORA_URL', value: 'https://blockstream.info/api' }
              { name: 'BITCOIN_NETWORK', value: 'mainnet' }
              { name: 'LIGHTNING_PROVIDER', value: 'lnbits' }
            ],
            (!empty(lnbitsUrl)) ? [ { name: 'LN_BITS_URL', secretRef: 'lnbits-url' } ] : [],
            (!empty(lnbitsApiKey)) ? [ { name: 'LN_BITS_API_KEY', secretRef: 'lnbits-api-key' } ] : [],
            useOtel ? [ { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', value: otelEndpoint } ] : [],
            (useOtel && !empty(otelHeaders)) ? [ { name: 'OTEL_EXPORTER_OTLP_HEADERS', secretRef: 'otel-headers' } ] : []
          )
        }
      ]
    }
  }
}

output containerAppFqdn string = app.properties.configuration.ingress.fqdn
