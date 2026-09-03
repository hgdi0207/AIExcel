# Java Pivot Export Service

Internal Spring Boot service for AI Excel pivot export.

Current status:
- Health check is ready.
- Internal auth is ready.
- `POST /internal/pivot/export` is ready.
- The export implementation now creates a real native Excel PivotTable with Apache POI.
- Filters are applied by pruning source rows before the pivot is built; report filter fields are also added to the pivot when possible.

## Endpoints

- `GET /internal/health`
- `POST /internal/pivot/export`

## Environment Variables

- `PORT`: service port, default `8085`
- `PIVOT_EXPORT_SHARED_TOKEN`: shared internal token
- `PIVOT_EXPORT_STORAGE_ROOT`: export root directory
- `PIVOT_EXPORT_ALLOWED_SOURCE_ROOTS`: allowed upload roots, comma-separated; default includes `../backend/storage/uploads`

## Local Run

```bash
mvn spring-boot:run
```

## Package

```bash
mvn clean package
```

## Docker Build

```bash
docker build -t java-pivot-export-service .
```

## Notes

- This service is designed for backend-to-backend calls only.
- Browsers should still download files through the NestJS backend.
- The generated workbook should contain native pivot structures such as `pivotTables` and `pivotCache`.
- Apache POI's high-level pivot API supports row labels, column labels, value fields, and report filters. Filter operators and values are applied during source-data export so the final pivot result matches the requested config.
