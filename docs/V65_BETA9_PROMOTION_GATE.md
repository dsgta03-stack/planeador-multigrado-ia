# V6.5 Beta.9 Promotion Gate

Estado: en preparación para promoción.

Bloqueos de promoción:

1. La preservación de la selección del docente debe verificarse de forma calculada, no con un valor fijo.
2. La estructura curricular V6.4 debe permanecer idéntica en sesiones, minutos, grados, PDA y LTG.
3. Los grados transversales deben conservar `pda_ids: []` y no recibir LTG automáticos.
4. Deben pasar regresiones de ABP, STEAM, Aprendizaje Servicio y Proyectos Comunitarios.
5. Las peticiones sin autenticación deben fallar antes de consumir modelo.
6. V6.4 permanece como fallback hasta que el promotion gate completo sea PASS.

No promover V6.5 a visible mientras cualquiera de estas compuertas falle.
