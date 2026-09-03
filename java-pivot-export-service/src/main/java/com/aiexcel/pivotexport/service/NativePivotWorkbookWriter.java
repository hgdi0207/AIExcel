package com.aiexcel.pivotexport.service;

import com.aiexcel.pivotexport.model.PivotExportRequest;
import com.aiexcel.pivotexport.web.PivotExportException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.apache.poi.ss.SpreadsheetVersion;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DataConsolidateFunction;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FormulaError;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.AreaReference;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFPivotTable;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

@Component
public class NativePivotWorkbookWriter {

  public static final String PIVOT_SHEET_NAME = "Pivot";

  private static final int MAX_AUTOSIZE_COLUMNS = 12;

  private final DataFormatter dataFormatter = new DataFormatter(Locale.US);

  public XSSFWorkbook write(LoadedWorkbook loadedWorkbook, PivotExportRequest request) {
    SourceData sourceData = extractSourceData(loadedWorkbook.selectedSheet(), request.pivotConfig());
    validatePivotFields(sourceData.headers(), request.pivotConfig());

    XSSFWorkbook exportWorkbook = new XSSFWorkbook();
    XSSFSheet sourceDataSheet =
        exportWorkbook.createSheet(WorkbookUtil.createSafeSheetName("Source Data"));
    XSSFSheet pivotSheet =
        exportWorkbook.createSheet(WorkbookUtil.createSafeSheetName(PIVOT_SHEET_NAME));

    writeSourceDataSheet(exportWorkbook, sourceDataSheet, sourceData);
    buildPivotTable(sourceDataSheet, pivotSheet, sourceData, request.pivotConfig());

    autoSize(sourceDataSheet, sourceData.headers().size());
    return exportWorkbook;
  }

  private SourceData extractSourceData(
      Sheet sourceSheet,
      PivotExportRequest.PivotConfig pivotConfig
  ) {
    int maxColumnCount = calculateMaxColumnCount(sourceSheet);
    if (maxColumnCount <= 0) {
      throw PivotExportException.invalidArgument(
          "INVALID_ARGUMENT",
          "Source sheet has no usable columns."
      );
    }

    Row headerRow = sourceSheet.getRow(0);
    if (headerRow == null) {
      throw PivotExportException.invalidArgument(
          "INVALID_ARGUMENT",
          "Source sheet is missing the header row."
      );
    }

    List<String> headers = buildHeaders(headerRow, maxColumnCount);
    Map<String, Integer> headerIndexMap = buildHeaderIndexMap(headers);
    Set<Integer> preferredNumericColumns = resolvePreferredNumericColumns(headerIndexMap, pivotConfig);

    List<List<SourceCellValue>> rows = new ArrayList<>();
    for (int rowIndex = 1; rowIndex <= sourceSheet.getLastRowNum(); rowIndex++) {
      Row row = sourceSheet.getRow(rowIndex);
      List<SourceCellValue> values = extractRowValues(row, maxColumnCount, preferredNumericColumns);
      if (isBlankRow(values)) {
        continue;
      }
      if (!passesFilters(headerIndexMap, values, pivotConfig.filters())) {
        continue;
      }
      rows.add(values);
    }

    if (rows.isEmpty()) {
      throw PivotExportException.invalidArgument(
          "PIVOT_SOURCE_EMPTY",
          "No data rows remain after applying pivot filters."
      );
    }

    return new SourceData(headers, rows);
  }

  private void validatePivotFields(
      List<String> headers,
      PivotExportRequest.PivotConfig pivotConfig
  ) {
    Map<String, Integer> headerIndexMap = buildHeaderIndexMap(headers);
    Set<Integer> axisColumns = new HashSet<>();

    for (String field : safeList(pivotConfig.rows())) {
      axisColumns.add(resolveRequiredColumnIndex(headerIndexMap, field));
    }

    for (String field : safeList(pivotConfig.columns())) {
      axisColumns.add(resolveRequiredColumnIndex(headerIndexMap, field));
    }

    for (PivotExportRequest.PivotValueConfig valueConfig : safeList(pivotConfig.values())) {
      int valueColumnIndex = resolveRequiredColumnIndex(headerIndexMap, valueConfig.field());
      if (axisColumns.contains(valueColumnIndex)) {
        throw PivotExportException.invalidArgument(
            "PIVOT_CONFIG_INVALID",
            "A pivot value field cannot also be used as a row or column axis field: " + valueConfig.field()
        );
      }
      toConsolidateFunction(valueConfig.aggregation());
    }
  }

  private void writeSourceDataSheet(
      XSSFWorkbook exportWorkbook,
      XSSFSheet sourceDataSheet,
      SourceData sourceData
  ) {
    CellStyle headerStyle = createHeaderStyle(exportWorkbook);
    Map<String, CellStyle> dataFormatStyles = new HashMap<>();

    Row headerRow = sourceDataSheet.createRow(0);
    for (int columnIndex = 0; columnIndex < sourceData.headers().size(); columnIndex++) {
      Cell cell = headerRow.createCell(columnIndex);
      cell.setCellValue(sourceData.headers().get(columnIndex));
      cell.setCellStyle(headerStyle);
    }

    for (int rowIndex = 0; rowIndex < sourceData.rows().size(); rowIndex++) {
      Row targetRow = sourceDataSheet.createRow(rowIndex + 1);
      List<SourceCellValue> values = sourceData.rows().get(rowIndex);

      for (int columnIndex = 0; columnIndex < values.size(); columnIndex++) {
        writeCellValue(exportWorkbook, targetRow.createCell(columnIndex), values.get(columnIndex), dataFormatStyles);
      }
    }
  }

  private void buildPivotTable(
      XSSFSheet sourceDataSheet,
      XSSFSheet pivotSheet,
      SourceData sourceData,
      PivotExportRequest.PivotConfig pivotConfig
  ) {
    AreaReference sourceArea = new AreaReference(
        new CellReference(0, 0),
        new CellReference(sourceData.rows().size(), sourceData.headers().size() - 1),
        SpreadsheetVersion.EXCEL2007
    );

    XSSFPivotTable pivotTable =
        pivotSheet.createPivotTable(sourceArea, new CellReference(0, 0), sourceDataSheet);
    Map<String, Integer> headerIndexMap = buildHeaderIndexMap(sourceData.headers());
    Set<Integer> reservedColumns = new HashSet<>();
    Set<Integer> usedReportFilterColumns = new HashSet<>();

    for (String field : safeList(pivotConfig.rows())) {
      int columnIndex = resolveRequiredColumnIndex(headerIndexMap, field);
      reservedColumns.add(columnIndex);
      pivotTable.addRowLabel(columnIndex);
    }

    for (String field : safeList(pivotConfig.columns())) {
      int columnIndex = resolveRequiredColumnIndex(headerIndexMap, field);
      reservedColumns.add(columnIndex);
      pivotTable.addColLabel(columnIndex);
    }

    for (PivotExportRequest.PivotValueConfig valueConfig : safeList(pivotConfig.values())) {
      int columnIndex = resolveRequiredColumnIndex(headerIndexMap, valueConfig.field());
      reservedColumns.add(columnIndex);
      pivotTable.addColumnLabel(
          toConsolidateFunction(valueConfig.aggregation()),
          columnIndex,
          buildValueFieldName(valueConfig)
      );
    }

    for (PivotExportRequest.PivotFilterConfig filterConfig : safeList(pivotConfig.filters())) {
      int columnIndex = resolveRequiredColumnIndex(headerIndexMap, filterConfig.field());
      if (!reservedColumns.contains(columnIndex) && usedReportFilterColumns.add(columnIndex)) {
        pivotTable.addReportFilter(columnIndex);
      }
    }
  }

  private List<String> buildHeaders(Row headerRow, int maxColumnCount) {
    Map<String, Integer> duplicates = new HashMap<>();
    List<String> headers = new ArrayList<>(maxColumnCount);

    for (int columnIndex = 0; columnIndex < maxColumnCount; columnIndex++) {
      Cell cell = headerRow.getCell(columnIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
      String header = cell == null ? "" : dataFormatter.formatCellValue(cell).trim();
      if (header.isBlank()) {
        header = "Column" + (columnIndex + 1);
      }

      String normalized = normalizeHeader(header);
      int duplicateCount = duplicates.getOrDefault(normalized, 0) + 1;
      duplicates.put(normalized, duplicateCount);
      if (duplicateCount > 1) {
        header = header + "_" + duplicateCount;
      }

      headers.add(header);
    }

    return headers;
  }

  private Map<String, Integer> buildHeaderIndexMap(List<String> headers) {
    Map<String, Integer> result = new LinkedHashMap<>();
    for (int index = 0; index < headers.size(); index++) {
      result.put(normalizeHeader(headers.get(index)), index);
    }
    return result;
  }

  private Set<Integer> resolvePreferredNumericColumns(
      Map<String, Integer> headerIndexMap,
      PivotExportRequest.PivotConfig pivotConfig
  ) {
    Set<Integer> result = new HashSet<>();

    for (PivotExportRequest.PivotValueConfig valueConfig : safeList(pivotConfig.values())) {
      Integer columnIndex = headerIndexMap.get(normalizeHeader(valueConfig.field()));
      if (columnIndex != null) {
        result.add(columnIndex);
      }
    }

    for (PivotExportRequest.PivotFilterConfig filterConfig : safeList(pivotConfig.filters())) {
      Integer columnIndex = headerIndexMap.get(normalizeHeader(filterConfig.field()));
      if (columnIndex != null && shouldPreferNumericFilter(filterConfig)) {
        result.add(columnIndex);
      }
    }

    return result;
  }

  private boolean shouldPreferNumericFilter(PivotExportRequest.PivotFilterConfig filterConfig) {
    String operator = filterConfig.operator().trim();
    if (operator.equals(">") || operator.equals(">=") || operator.equals("<") || operator.equals("<=")) {
      return true;
    }
    return tryParseNumber(filterConfig.value()) != null;
  }

  private List<SourceCellValue> extractRowValues(
      Row row,
      int columnCount,
      Set<Integer> preferredNumericColumns
  ) {
    List<SourceCellValue> values = new ArrayList<>(columnCount);
    for (int columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      Cell cell =
          row == null ? null : row.getCell(columnIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
      values.add(extractCellValue(cell, preferredNumericColumns.contains(columnIndex)));
    }
    return values;
  }

  private SourceCellValue extractCellValue(Cell cell, boolean preferNumeric) {
    if (cell == null) {
      return SourceCellValue.blank();
    }

    String dataFormat = resolveDataFormat(cell);
    switch (cell.getCellType()) {
      case STRING:
        return resolveStringCellValue(cell.getStringCellValue(), preferNumeric, dataFormat);
      case NUMERIC:
        if (DateUtil.isCellDateFormatted(cell)) {
          return SourceCellValue.date(cell.getDateCellValue(), dataFormatter.formatCellValue(cell), dataFormat);
        }
        return SourceCellValue.numeric(cell.getNumericCellValue(), dataFormatter.formatCellValue(cell), dataFormat);
      case BOOLEAN:
        return SourceCellValue.bool(cell.getBooleanCellValue(), dataFormatter.formatCellValue(cell));
      case FORMULA:
        return extractFormulaCellValue(cell, preferNumeric, dataFormat);
      case BLANK:
        return SourceCellValue.blank();
      case ERROR:
        return SourceCellValue.string(
            FormulaError.forInt(cell.getErrorCellValue()).getString(),
            dataFormatter.formatCellValue(cell)
        );
      default:
        return SourceCellValue.string(dataFormatter.formatCellValue(cell), dataFormatter.formatCellValue(cell));
    }
  }

  private SourceCellValue extractFormulaCellValue(Cell cell, boolean preferNumeric, String dataFormat) {
    switch (cell.getCachedFormulaResultType()) {
      case STRING:
        return resolveStringCellValue(cell.getStringCellValue(), preferNumeric, dataFormat);
      case NUMERIC:
        if (DateUtil.isCellDateFormatted(cell)) {
          return SourceCellValue.date(cell.getDateCellValue(), dataFormatter.formatCellValue(cell), dataFormat);
        }
        return SourceCellValue.numeric(cell.getNumericCellValue(), dataFormatter.formatCellValue(cell), dataFormat);
      case BOOLEAN:
        return SourceCellValue.bool(cell.getBooleanCellValue(), dataFormatter.formatCellValue(cell));
      case ERROR:
        return SourceCellValue.string(
            FormulaError.forInt(cell.getErrorCellValue()).getString(),
            dataFormatter.formatCellValue(cell)
        );
      case BLANK:
      default:
        return SourceCellValue.blank();
    }
  }

  private SourceCellValue resolveStringCellValue(
      String rawValue,
      boolean preferNumeric,
      String dataFormat
  ) {
    String normalized = rawValue == null ? "" : rawValue.trim();
    if (normalized.isEmpty()) {
      return SourceCellValue.blank();
    }

    if (preferNumeric) {
      Double numericValue = tryParseNumber(normalized);
      if (numericValue != null) {
        return SourceCellValue.numeric(numericValue, normalized, dataFormat);
      }
    }

    if ("true".equalsIgnoreCase(normalized) || "false".equalsIgnoreCase(normalized)) {
      return SourceCellValue.bool(Boolean.parseBoolean(normalized), normalized);
    }

    return SourceCellValue.string(normalized, normalized);
  }

  private boolean isBlankRow(List<SourceCellValue> rowValues) {
    return rowValues.stream().allMatch(value -> value.kind() == SourceCellKind.BLANK);
  }

  private boolean passesFilters(
      Map<String, Integer> headerIndexMap,
      List<SourceCellValue> rowValues,
      List<PivotExportRequest.PivotFilterConfig> filters
  ) {
    for (PivotExportRequest.PivotFilterConfig filter : safeList(filters)) {
      int columnIndex = resolveRequiredColumnIndex(headerIndexMap, filter.field());
      SourceCellValue value = rowValues.get(columnIndex);
      if (!passesFilter(value, filter)) {
        return false;
      }
    }
    return true;
  }

  private boolean passesFilter(
      SourceCellValue sourceValue,
      PivotExportRequest.PivotFilterConfig filter
  ) {
    String operator = filter.operator().trim();
    String compareValue = filter.value();

    Double sourceNumeric = sourceValue.numericValue();
    Double compareNumeric = tryParseNumber(compareValue);
    String sourceText = sourceValue.displayValue();

    switch (operator) {
      case "!=":
      case "<>":
        return !sourceText.equals(compareValue);
      case ">":
        return sourceNumeric != null && compareNumeric != null
            ? sourceNumeric > compareNumeric
            : sourceText.compareTo(compareValue) > 0;
      case ">=":
        return sourceNumeric != null && compareNumeric != null
            ? sourceNumeric >= compareNumeric
            : sourceText.compareTo(compareValue) >= 0;
      case "<":
        return sourceNumeric != null && compareNumeric != null
            ? sourceNumeric < compareNumeric
            : sourceText.compareTo(compareValue) < 0;
      case "<=":
        return sourceNumeric != null && compareNumeric != null
            ? sourceNumeric <= compareNumeric
            : sourceText.compareTo(compareValue) <= 0;
      case "contains":
        return sourceText.contains(compareValue);
      case "startsWith":
        return sourceText.startsWith(compareValue);
      case "endsWith":
        return sourceText.endsWith(compareValue);
      case "=":
      case "==":
      default:
        return sourceText.equals(compareValue);
    }
  }

  private int calculateMaxColumnCount(Sheet sourceSheet) {
    int maxColumnCount = 0;
    for (int rowIndex = 0; rowIndex <= sourceSheet.getLastRowNum(); rowIndex++) {
      Row row = sourceSheet.getRow(rowIndex);
      if (row != null && row.getLastCellNum() > 0) {
        maxColumnCount = Math.max(maxColumnCount, row.getLastCellNum());
      }
    }
    return maxColumnCount;
  }

  private int resolveRequiredColumnIndex(Map<String, Integer> headerIndexMap, String fieldName) {
    Integer columnIndex = headerIndexMap.get(normalizeHeader(fieldName));
    if (columnIndex == null) {
      throw PivotExportException.invalidArgument(
          "PIVOT_CONFIG_INVALID",
          "Pivot field not found in source headers: " + fieldName
      );
    }
    return columnIndex;
  }

  private String normalizeHeader(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private DataConsolidateFunction toConsolidateFunction(String aggregation) {
    String normalized = aggregation == null ? "" : aggregation.trim().toLowerCase(Locale.ROOT);
    switch (normalized) {
      case "sum":
        return DataConsolidateFunction.SUM;
      case "avg":
      case "average":
        return DataConsolidateFunction.AVERAGE;
      case "count":
        return DataConsolidateFunction.COUNT;
      case "min":
        return DataConsolidateFunction.MIN;
      case "max":
        return DataConsolidateFunction.MAX;
      default:
        throw PivotExportException.invalidArgument(
            "PIVOT_CONFIG_INVALID",
            "Unsupported pivot aggregation: " + aggregation
        );
    }
  }

  private String buildValueFieldName(PivotExportRequest.PivotValueConfig valueConfig) {
    String functionLabel;
    switch (valueConfig.aggregation().trim().toLowerCase(Locale.ROOT)) {
      case "sum":
        functionLabel = "Sum";
        break;
      case "avg":
      case "average":
        functionLabel = "Average";
        break;
      case "count":
        functionLabel = "Count";
        break;
      case "min":
        functionLabel = "Min";
        break;
      case "max":
        functionLabel = "Max";
        break;
      default:
        functionLabel = valueConfig.aggregation();
        break;
    }
    return functionLabel + " of " + valueConfig.field();
  }

  private void writeCellValue(
      XSSFWorkbook workbook,
      Cell targetCell,
      SourceCellValue sourceCellValue,
      Map<String, CellStyle> dataFormatStyles
  ) {
    switch (sourceCellValue.kind()) {
      case DATE:
        targetCell.setCellValue((Date) sourceCellValue.rawValue());
        applyDataFormatIfNeeded(workbook, targetCell, sourceCellValue.dataFormat(), dataFormatStyles);
        break;
      case NUMERIC:
        targetCell.setCellValue((Double) sourceCellValue.rawValue());
        applyDataFormatIfNeeded(workbook, targetCell, sourceCellValue.dataFormat(), dataFormatStyles);
        break;
      case BOOLEAN:
        targetCell.setCellValue((Boolean) sourceCellValue.rawValue());
        break;
      case STRING:
        targetCell.setCellValue(sourceCellValue.displayValue());
        break;
      case BLANK:
      default:
        targetCell.setBlank();
        break;
    }
  }

  private void applyDataFormatIfNeeded(
      XSSFWorkbook workbook,
      Cell cell,
      String dataFormat,
      Map<String, CellStyle> dataFormatStyles
  ) {
    if (dataFormat == null || dataFormat.isBlank() || "General".equalsIgnoreCase(dataFormat)) {
      return;
    }

    CellStyle style = dataFormatStyles.computeIfAbsent(dataFormat, format -> {
      CreationHelper creationHelper = workbook.getCreationHelper();
      CellStyle createdStyle = workbook.createCellStyle();
      createdStyle.setDataFormat(creationHelper.createDataFormat().getFormat(format));
      return createdStyle;
    });
    cell.setCellStyle(style);
  }

  private CellStyle createHeaderStyle(XSSFWorkbook workbook) {
    CellStyle style = workbook.createCellStyle();
    org.apache.poi.ss.usermodel.Font font = workbook.createFont();
    font.setBold(true);
    style.setFont(font);
    return style;
  }

  private void autoSize(XSSFSheet sheet, int columnCount) {
    for (int columnIndex = 0; columnIndex < Math.min(columnCount, MAX_AUTOSIZE_COLUMNS); columnIndex++) {
      sheet.autoSizeColumn(columnIndex);
    }
  }

  private String resolveDataFormat(Cell cell) {
    CellStyle style = cell.getCellStyle();
    if (style == null) {
      return "";
    }
    String format = style.getDataFormatString();
    return format == null ? "" : format;
  }

  private Double tryParseNumber(String value) {
    try {
      return Double.parseDouble(value.replace(",", ""));
    } catch (Exception ignore) {
      return null;
    }
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? List.of() : values;
  }

  private record SourceData(
      List<String> headers,
      List<List<SourceCellValue>> rows
  ) {}

  private record SourceCellValue(
      SourceCellKind kind,
      Object rawValue,
      String displayValue,
      String dataFormat
  ) {
    static SourceCellValue blank() {
      return new SourceCellValue(SourceCellKind.BLANK, null, "", "");
    }

    static SourceCellValue string(String value, String displayValue) {
      return new SourceCellValue(SourceCellKind.STRING, value, displayValue, "");
    }

    static SourceCellValue numeric(Double value, String displayValue, String dataFormat) {
      return new SourceCellValue(SourceCellKind.NUMERIC, value, displayValue, dataFormat);
    }

    static SourceCellValue bool(Boolean value, String displayValue) {
      return new SourceCellValue(SourceCellKind.BOOLEAN, value, displayValue, "");
    }

    static SourceCellValue date(Date value, String displayValue, String dataFormat) {
      return new SourceCellValue(SourceCellKind.DATE, value, displayValue, dataFormat);
    }

    Double numericValue() {
      if (kind == SourceCellKind.NUMERIC) {
        return (Double) rawValue;
      }
      if (kind == SourceCellKind.DATE && rawValue instanceof Date) {
        return (double) ((Date) rawValue).getTime();
      }
      return null;
    }
  }

  private enum SourceCellKind {
    STRING,
    NUMERIC,
    BOOLEAN,
    DATE,
    BLANK
  }
}
