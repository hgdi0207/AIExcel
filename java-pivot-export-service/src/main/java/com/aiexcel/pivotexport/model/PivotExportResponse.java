package com.aiexcel.pivotexport.model;

public record PivotExportResponse(
    boolean success,
    String requestId,
    Data data
) {

  public record Data(
      String exportFileName,
      String exportFilePath,
      String sheetName,
      long fileSizeBytes
  ) {}
}
