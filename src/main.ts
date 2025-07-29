import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

/**
 * Bootstrap function initializes the Coffea Relay Service.
 *
 * This function:
 * - Creates the NestJS application instance
 * - Configures global validation pipes
 * - Sets up Swagger API documentation
 * - Configures CORS for cross-origin requests
 * - Starts the HTTP server on the configured port
 *
 * Environment Configuration:
 * - PORT: HTTP server port (default: 3003)
 * - NODE_ENV: Application environment
 * - ENABLE_SWAGGER: Enable/disable API documentation
 */
async function bootstrap() {
  // Create NestJS application
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global validation pipe for request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS for frontend integration
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  // API prefix for versioning
  app.setGlobalPrefix("api");

  // Swagger API documentation setup
  const enableSwagger =
    configService.get<string>("ENABLE_SWAGGER", "true") === "true";
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle("Coffea Relay Service")
      .setDescription(
        `
        ## Coffea Relay Service API

        A custom blockchain transaction relay service that provides gasless transaction execution for DeFi strategies. 
        Built as a cost-effective alternative to Gelato Network's relay service.

        ### Features
        - **Gasless Transactions**: Users execute DeFi strategies without paying gas fees
        - **Multi-Chain Support**: Ethereum Mainnet, Sepolia testnet, and Hardhat development
        - **Real-time Monitoring**: Transaction status tracking with WebSocket and polling
        - **Cost Optimization**: No premium fees, only actual gas costs
        - **Comprehensive Analytics**: Full transaction history and performance metrics

        ### Supported Networks
        - **Ethereum Mainnet** (Chain ID: 1)
        - **Sepolia Testnet** (Chain ID: 11155111)
        - **Hardhat Local** (Chain ID: 31337)

        ### Usage Flow
        1. Submit gasless transaction via \`POST /api/relay/sponsored-call\`
        2. Monitor transaction status via \`GET /api/relay/status/:taskId\`
        3. Transaction is automatically executed and confirmed
        4. Receive final status with transaction details

        ### Integration
        This service implements the same API interface as Gelato relay for easy integration
        with existing applications. Simply update your endpoint URLs to use this service.
      `,
      )
      .setVersion("1.0.0")
      .addTag("relay", "Core relay transaction endpoints")
      .addTag("health", "Service health monitoring")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        showRequestHeaders: true,
      },
    });

    console.log(
      "📚 Swagger documentation available at: http://localhost:3003/api/docs",
    );
  }

  // Start HTTP server
  const port = configService.get<number>("PORT", 3003);
  await app.listen(port);

  console.log(`🚀 Coffea Relay Service started on port ${port}`);
  console.log(`🌐 API endpoints available at: http://localhost:${port}/api`);
  console.log(
    `❤️  Health check available at: http://localhost:${port}/api/health`,
  );

  if (enableSwagger) {
    console.log(`📖 API documentation: http://localhost:${port}/api/docs`);
  }

  // Log supported chains
  const supportedChains = [
    { name: "Ethereum Mainnet", chainId: 1 },
    { name: "Sepolia Testnet", chainId: 11155111 },
    { name: "Hardhat Local", chainId: 31337 },
  ];

  console.log("\n🔗 Supported blockchain networks:");
  supportedChains.forEach((chain) => {
    console.log(`   • ${chain.name} (Chain ID: ${chain.chainId})`);
  });

  // Environment information
  const environment = configService.get<string>("NODE_ENV", "development");
  console.log(`\n🔧 Environment: ${environment}`);

  if (environment === "development") {
    console.log("⚠️  Development mode: Database synchronization enabled");
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Bootstrap the application
bootstrap().catch((error) => {
  console.error("Failed to start Coffea Relay Service:", error);
  process.exit(1);
});
