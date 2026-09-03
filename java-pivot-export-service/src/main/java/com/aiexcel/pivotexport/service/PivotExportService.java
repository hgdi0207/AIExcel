package com.aiexcel.pivotexport.service;

import com.aiexcel.pivotexport.config.PivotExportProperties;
import com.aiexcel.pivotexport.model.PivotExportRequest;
import com.aiexcel.pivotexport.model.PivotExportResponse;
import com.aiexcel.pivotexport.web.PivotExportException;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.List;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

@Service
public class PivotExportService {

  private final PivotExportProperties properties;
  private final WorkbookLoader workbookLoader;
  private final NativePivotWorkbookWriter workbookWriter;

  public PivotExportService(
      PivotExportProperties properties,
      WorkbookLoader workbookLoader,
      NativePivotWorkbookWriter workbookWriter
  ) {
    this.properties = properties;
    this.workbookLoader = workbookLoader;
    this.workbookWriter = workbookWriter;
  }

  public PivotExportResponse.Data export(PivotExportRequest request) {
    Path sourcePath = resolveAllowedSourcePath(request.sourceFilePath());
    Path outputPath = buildOutputPath(request.jobId(), request.outputFileName());
    try {
      Files.createDirectories(outputPath.getParent());
    } catch (IOException exception) {
      throw PivotExportException.internal("OUTPUT_WRITE_FAILED", "Failed to prepare export directory.", exception);
    }

    try {
      try (LoadedWorkbook loadedWorkbook = workbookLoader.load(sourcePath, request.sourceSheetName());
           XSSFWorkbook exportWorkbook = workbookWriter.write(loadedWorkbook, request);
           OutputStream outputStream = Files.newOutputStream(outputPath)) {
        exportWorkbook.write(outputStream);
        outputStream.flush();
      }

      validateNativePivotWorkbook(outputPath);

      long fileSizeBytes = Files.size(outputPath);
      return new PivotExportResponse.Data(
          outputPath.getFileName().toString(),
          outputPath.toString(),
          NativePivotWorkbookWriter.PIVOT_SHEET_NAME,
          fileSizeBytes
      );
    } catch (IOException exception) {
      try {
        Files.deleteIfExists(outputPath);
      } catch (IOException ignore) {
        // ignore cleanup failures
      }
      throw PivotExportException.internal("OUTPUT_WRITE_FAILED", "Failed to write export workbook.", exception);
    }
  }

  private void validateNativePivotWorkbook(Path outputPath) throws IOException {
    try (ZipFile zipFile = new ZipFile(outputPath.toFile())) {
      boolean hasPivotTable = false;
      boolean hasPivotCache = false;

      for (ZipEntry entry : java.util.Collections.list(zipFile.entries())) {
        String name = entry.getName();
        if (name.startsWith("xl/pivotTables/")) {
          hasPivotTable = true;
        }
        if (name.startsWith("xl/pivotCache/")) {
          hasPivotCache = true;
        }
      }

      if (!hasPivotTable || !hasPivotCache) {
        throw new IOException(
            "Generated workbook does not contain native pivot parts (pivotTables/pivotCache)."
        );
      }
    }
  }

  private Path resolveAllowedSourcePath(String rawPath) {
    Path sourcePath = Path.of(rawPath).normalize().toAbsolutePath();
    List<Path> allowedRoots = properties.getAllowedSourceRootPaths();
    boolean allowed = allowedRoots.stream().anyMatch(sourcePath::startsWith);

    if (!allowed) {
      throw PivotExportException.invalidArgument(
          "INVALID_ARGUMENT",
          "Source file path is outside the allowed source roots."
      );
    }

    if (!Files.exists(sourcePath) || !Files.isRegularFile(sourcePath)) {
      throw PivotExportException.invalidArgument("SOURCE_FILE_NOT_FOUND", "Source file does not exist.");
    }

    return sourcePath;
  }

  private Path buildOutputPath(String jobId, String outputFileName) {
    String safeJobId = sanitizePathToken(jobId);
    String safeFileName = sanitizeFileName(outputFileName);
    return properties.getOutputRootPath().resolve(safeJobId).resolve(safeFileName).normalize().toAbsolutePath();
  }

  private String sanitizePathToken(String value) {
    String sanitized = value.replaceAll("[^a-zA-Z0-9._-]", "-").trim();
    if (sanitized.isEmpty()) {
      throw PivotExportException.invalidArgument("INVALID_ARGUMENT", "jobId is invalid.");
    }
    return sanitized;
  }

  private String sanitizeFileName(String value) {
    String sanitized = value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", "-").trim();
    if (sanitized.isEmpty()) {
      throw PivotExportException.invalidArgument("INVALID_ARGUMENT", "outputFileName is invalid.");
    }
    if (!sanitized.toLowerCase().endsWith(".xlsx")) {
      sanitized = sanitized + ".xlsx";
    }
    return sanitized;
  }
}
