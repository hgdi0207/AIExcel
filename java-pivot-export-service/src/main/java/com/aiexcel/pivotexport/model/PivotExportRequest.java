package com.aiexcel.pivotexport.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record PivotExportRequest(
    @NotBlank String jobId,
    @NotBlank String userId,
    @NotBlank String sourceFilePath,
    @NotBlank String sourceFileName,
    String sourceSheetName,
    @NotBlank String outputFileName,
    @NotNull @Valid PivotConfig pivotConfig
) {

  public record PivotConfig(
      List<String> rows,
      List<String> columns,
      @NotEmpty @Valid List<PivotValueConfig> values,
      List<PivotFilterConfig> filters
  ) {}

  public record PivotValueConfig(
      @NotBlank String field,
      @NotBlank String aggregation
  ) {}

  public record PivotFilterConfig(
      @NotBlank String field,
      @NotBlank String operator,
      @NotBlank String value
  ) {}
}
