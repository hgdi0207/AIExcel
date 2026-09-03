package com.aiexcel.pivotexport.service;

import com.aiexcel.pivotexport.web.PivotExportException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

@Component
public class WorkbookLoader {

  public LoadedWorkbook load(Path sourcePath, String preferredSheetName) {
    final String lowerName = sourcePath.getFileName().toString().toLowerCase();
    try {
      if (lowerName.endsWith(".csv")) {
        return loadCsv(sourcePath, preferredSheetName);
      }

      try (InputStream inputStream = Files.newInputStream(sourcePath)) {
        Workbook workbook = WorkbookFactory.create(inputStream);
        if (workbook.getNumberOfSheets() == 0) {
          workbook.close();
          throw PivotExportException.invalidArgument("SOURCE_SHEET_NOT_FOUND", "Workbook has no sheets.");
        }

        Sheet selectedSheet = resolveSheet(workbook, preferredSheetName);
        return new LoadedWorkbook(workbook, selectedSheet, selectedSheet.getSheetName());
      }
    } catch (IOException exception) {
      throw PivotExportException.internal("SOURCE_FILE_NOT_FOUND", "Failed to load source workbook.", exception);
    }
  }

  private LoadedWorkbook loadCsv(Path sourcePath, String preferredSheetName) throws IOException {
    XSSFWorkbook workbook = new XSSFWorkbook();
    String sheetName = preferredSheetName != null && !preferredSheetName.isBlank()
        ? preferredSheetName
        : "Sheet1";
    Sheet sheet = workbook.createSheet(sheetName);

    try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(Files.newInputStream(sourcePath), StandardCharsets.UTF_8));
         CSVParser parser = CSVFormat.DEFAULT.parse(reader)) {
      int rowIndex = 0;
      for (CSVRecord record : parser) {
        Row row = sheet.createRow(rowIndex++);
        for (int columnIndex = 0; columnIndex < record.size(); columnIndex++) {
          row.createCell(columnIndex).setCellValue(record.get(columnIndex));
        }
      }
    }

    return new LoadedWorkbook(workbook, sheet, sheet.getSheetName());
  }

  private Sheet resolveSheet(Workbook workbook, String preferredSheetName) {
    if (preferredSheetName != null && !preferredSheetName.isBlank()) {
      Sheet preferred = workbook.getSheet(preferredSheetName);
      if (preferred != null) {
        return preferred;
      }
    }
    return workbook.getSheetAt(0);
  }
}
