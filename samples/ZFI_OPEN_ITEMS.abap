*&---------------------------------------------------------------------*
*& Report ZFI_OPEN_ITEMS
*& Reports open G/L and customer items for a company code.
*& (Synthetic sample for S/4HANA readiness scanning)
*&---------------------------------------------------------------------*
REPORT zfi_open_items.

PARAMETERS: p_bukrs TYPE bsis-bukrs,
            p_hkont TYPE bsis-hkont.

DATA: lv_kunnr TYPE kna1-kunnr.

START-OF-SELECTION.

* Open G/L items from removed secondary index table BSIS
  SELECT * FROM bsis CLIENT SPECIFIED
    INTO TABLE @DATA(lt_gl_open)
    WHERE mandt = '100'
      AND bukrs = @p_bukrs
      AND hkont = @p_hkont.

* Open customer items from removed secondary index table BSID
  SELECT bukrs kunnr dmbtr
    FROM bsid
    INTO TABLE @DATA(lt_cust_open)
    WHERE bukrs = @p_bukrs.

* Native SQL lookup against the customer master (bypasses Open SQL / BP model)
  EXEC SQL.
    SELECT kunnr INTO :lv_kunnr FROM kna1 WHERE land1 = 'DE'
  ENDEXEC.

  WRITE: / 'Open items report for', p_bukrs.
