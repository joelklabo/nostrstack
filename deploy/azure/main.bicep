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
param otelEnabled bool = false
param otelEndpoint string = ''
@secure()
param otelHeaders string = ''
param logAnalyticsWorkspaceId string = ''
@secure()
param logAnalyticsSharedKey string = ''

var useRegistry = !empty(registryServer)
var useOtel = otelEnabled && !empty(otelEndpoint)
var useLogAnalytics = !empty(logAnalyticsWorkspaceId) && !empty(logAnalyticsSharedKey)

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    accessPolicies: []
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
  name: '${kv.name}/DATABASE_URL'
  properties: { value: dbUrl }
}
resource secretAdmin 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${kv.name}/ADMIN_API_KEY'
  properties: { value: adminApiKey }
}
resource secretOp 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${kv.name}/OP_NODE_API_KEY'
  properties: { value: opNodeApiKey }
}
resource secretWebhook 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${kv.name}/OP_NODE_WEBHOOK_SECRET'
  properties: { value: opNodeWebhookSecret }
}

resource secretRegistry 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (useRegistry) {
  name: '${kv.name}/REGISTRY_PASSWORD'
  properties: { value: registryPassword }
}

resource secretOtelHeaders 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (useOtel && !empty(otelHeaders)) {
  name: '${kv.name}/OTEL_EXPORTER_OTLP_HEADERS'
  properties: { value: otelHeaders }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: useLogAnalytics ? {
    appLogsConfiguration: {
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspaceId
        sharedKey: logAnalyticsSharedKey
      }
    }
  } : {}
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
        (useOtel && !empty(otelHeaders)) ? [ { name: 'otel-headers', value: otelHeaders } ] : []
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
              { name: 'PUBLIC_ORIGIN', value: 'https://${appName}.azurecontainerapps.io' }
              { name: 'NODE_ENV', value: 'production' }
              { name: 'LOG_LEVEL', value: 'info' }
              { name: 'OTEL_ENABLED', value: string(otelEnabled) }
            ],
            useOtel ? [ { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', value: otelEndpoint } ] : [],
            (useOtel && !empty(otelHeaders)) ? [ { name: 'OTEL_EXPORTER_OTLP_HEADERS', secretRef: 'otel-headers' } ] : []
          )
        }
      ]
    }
  }
}

output containerAppFqdn string = app.properties.configuration.ingress.fqdn
