package com.aiexcel.pivotexport.web;

import org.springframework.http.HttpStatus;

public class PivotExportException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  public PivotExportException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public PivotExportException(HttpStatus status, String code, String message, Throwable cause) {
    super(message, cause);
    this.status = status;
    this.code = code;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }

  public static PivotExportException unauthorized(String code, String message) {
    return new PivotExportException(HttpStatus.UNAUTHORIZED, code, message);
  }

  public static PivotExportException invalidArgument(String code, String message) {
    return new PivotExportException(HttpStatus.BAD_REQUEST, code, message);
  }

  public static PivotExportException internal(String code, String message, Throwable cause) {
    return new PivotExportException(HttpStatus.INTERNAL_SERVER_ERROR, code, message, cause);
  }
}
