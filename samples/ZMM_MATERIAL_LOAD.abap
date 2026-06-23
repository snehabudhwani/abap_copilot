*&---------------------------------------------------------------------*
*& Report ZMM_MATERIAL_LOAD
*& Mass-creates materials via batch input recording of MM01.
*& (Synthetic sample for S/4HANA readiness scanning)
*&---------------------------------------------------------------------*
REPORT zmm_material_load.

DATA: lt_bdcdata TYPE TABLE OF bdcdata,
      lt_upload  TYPE TABLE OF string OCCURS 0 WITH HEADER LINE,
      lv_matkey  TYPE c LENGTH 18.

START-OF-SELECTION.

  LOOP AT lt_upload.

*   Derive a short key from the first 18 chars of the material number
    lv_matkey = lt_upload+0(18).

*   Build batch-input for transaction MM01 (fragile across S/4HANA screens)
    CLEAR lt_bdcdata.
    APPEND VALUE #( program = 'SAPLMGMM' dynpro = '0060' dynbegin = 'X' )
           TO lt_bdcdata.
    CALL TRANSACTION 'MM01' USING lt_bdcdata MODE 'N'.

  ENDLOOP.

* Read vendor master directly (Business Partner is mandatory in S/4HANA)
  SELECT * FROM lfa1
    INTO TABLE @DATA(lt_vendors)
    WHERE land1 = 'US'.

  WRITE: / 'Material load complete'.
