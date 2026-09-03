package com.aiexcel.pivotexport.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiexcel.pivotexport.model.PivotExportRequest;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class NativePivotWorkbookWriterTest {

  @Test
  void writeShouldProduceNativePivotParts() throws Exception {
    NativePivotWorkbookWriter writer = new NativePivotWorkbookWriter();

    try (XSSFWorkbook sourceWorkbook = new XSSFWorkbook()) {
      XSSFSheet sourceSheet = sourceWorkbook.createSheet("Sales");
      sourceSheet.createRow(0).createCell(0).setCellValue("Region");
      sourceSheet.getRow(0).createCell(1).setCellValue("Month");
      sourceSheet.getRow(0).createCell(2).setCellValue("Revenue");

      sourceSheet.createRow(1).createCell(0).setCellValue("North");
      sourceSheet.getRow(1).createCell(1).setCellValue("2025-01");
      sourceSheet.getRow(1).createCell(2).setCellValue(125000);

      sourceSheet.createRow(2).createCell(0).setCellValue("North");
      sourceSheet.getRow(2).createCell(1).setCellValue("2025-02");
      sourceSheet.getRow(2).createCell(2).setCellValue(132000);

      sourceSheet.createRow(3).createCell(0).setCellValue("South");
      sourceSheet.getRow(3).createCell(1).setCellValue("2025-01");
      sourceSheet.getRow(3).createCell(2).setCellValue(98000);

      PivotExportRequest request = new PivotExportRequest(
          "job-test",
          "user-test",
          "ignored.xlsx",
          "ignored.xlsx",
          "Sales",
          "sales-pivot.xlsx",
          new PivotExportRequest.PivotConfig(
              List.of("Region"),
              List.of("Month"),
              List.of(new PivotExportRequest.PivotValueConfig("Revenue", "sum")),
              List.of()
          )
      );

      try (LoadedWorkbook loadedWorkbook = new LoadedWorkbook(sourceWorkbook, sourceSheet, "Sales");
           XSSFWorkbook exportWorkbook = writer.write(loadedWorkbook, request)) {
        Path tempFile = Files.createTempFile("native-pivot-", ".xlsx");
        try {
          try (OutputStream outputStream = Files.newOutputStream(tempFile)) {
            exportWorkbook.write(outputStream);
          }

          assertTrue(hasZipEntryWithPrefix(tempFile, "xl/pivotTables/"));
          assertTrue(hasZipEntryWithPrefix(tempFile, "xl/pivotCache/"));
        } finally {
          Files.deleteIfExists(tempFile);
        }
      }
    }
  }

  private boolean hasZipEntryWithPrefix(Path file, String prefix) throws IOException {
    try (ZipFile zipFile = new ZipFile(file.toFile())) {
      for (ZipEntry entry : Collections.list(zipFile.entries())) {
        if (entry.getName().startsWith(prefix)) {
          return true;
        }
      }
      return false;
    }
  }
}
