package com.aiexcel.pivotexport.service;

import java.io.IOException;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;

public final class LoadedWorkbook implements AutoCloseable {
  private final Workbook workbook;
  private final Sheet selectedSheet;
  private final String selectedSheetName;

  public LoadedWorkbook(Workbook workbook, Sheet selectedSheet, String selectedSheetName) {
    this.workbook = workbook;
    this.selectedSheet = selectedSheet;
    this.selectedSheetName = selectedSheetName;
  }

  public Workbook workbook() {
    return workbook;
  }

  public Sheet selectedSheet() {
    return selectedSheet;
  }

  public String selectedSheetName() {
    return selectedSheetName;
  }

  @Override
  public void close() throws IOException {
    workbook.close();
  }
}
