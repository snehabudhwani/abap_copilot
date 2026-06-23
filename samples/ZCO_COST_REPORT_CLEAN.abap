*&---------------------------------------------------------------------*
*& Class ZCL_CO_COST_REPORT
*& Reads cost data with modern, mostly clean-core ABAP.
*& (Synthetic sample — demonstrates a high readiness score)
*&---------------------------------------------------------------------*
CLASS zcl_co_cost_report DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS run
      IMPORTING iv_kokrs        TYPE kokrs
      RETURNING VALUE(rt_result) TYPE STANDARD TABLE OF acdoca.
ENDCLASS.

CLASS zcl_co_cost_report IMPLEMENTATION.
  METHOD run.

*   Read from the Universal Journal with an explicit field list and ORDER BY
    SELECT rbukrs, racct, hsl, budat
      FROM acdoca
      WHERE rbukrs = @iv_kokrs
      ORDER BY budat DESCENDING
      INTO CORRESPONDING FIELDS OF TABLE @rt_result
      UP TO 100 ROWS.

*   Output via ALV (Fiori-elements friendly when exposed as CDS)
    cl_salv_table=>factory(
      IMPORTING r_salv_table = DATA(lo_alv)
      CHANGING  t_table      = rt_result ).
    lo_alv->display( ).

  ENDMETHOD.
ENDCLASS.
