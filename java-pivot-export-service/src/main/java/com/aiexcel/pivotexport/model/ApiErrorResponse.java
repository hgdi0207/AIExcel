package com.aiexcel.pivotexport.model;

public record ApiErrorResponse(
    boolean success,
    String requestId,
    ErrorDetail error
) {

  public record ErrorDetail(
      String code,
      String message
  ) {}
}
