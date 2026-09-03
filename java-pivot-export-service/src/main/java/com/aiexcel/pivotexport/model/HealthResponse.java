package com.aiexcel.pivotexport.model;

public record HealthResponse(
    boolean success,
    Data data
) {

  public record Data(String status) {}
}
