package com.aiexcel.pivotexport.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "pivot.export")
public class PivotExportProperties {

  private String sharedToken = "change-me";
  private String outputRoot = "../backend/storage/exports/pivot";
  private String allowedSourceRootsCsv = "../backend/storage/uploads,../backend/storage/local/uploads";

  public String getSharedToken() {
    return sharedToken;
  }

  public void setSharedToken(String sharedToken) {
    this.sharedToken = sharedToken;
  }

  public String getOutputRoot() {
    return outputRoot;
  }

  public void setOutputRoot(String outputRoot) {
    this.outputRoot = outputRoot;
  }

  public String getAllowedSourceRootsCsv() {
    return allowedSourceRootsCsv;
  }

  public void setAllowedSourceRootsCsv(String allowedSourceRootsCsv) {
    this.allowedSourceRootsCsv = allowedSourceRootsCsv;
  }

  public Path getOutputRootPath() {
    return Paths.get(outputRoot).normalize().toAbsolutePath();
  }

  public List<Path> getAllowedSourceRootPaths() {
    return Arrays.stream(allowedSourceRootsCsv.split(","))
        .map(String::trim)
        .filter(value -> !value.isEmpty())
        .map(Paths::get)
        .map(path -> path.normalize().toAbsolutePath())
        .collect(Collectors.toList());
  }
}
