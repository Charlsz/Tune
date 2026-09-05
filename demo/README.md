# demo/

Cliente mínimo para la Fase 5: mostrar la comparación baseline vs optimized y
hacer una predicción contra la API (`POST /predict`).

Opciones en orden de esfuerzo: CLI (`tune compare` + `curl`) → HTML+JS estático →
Gradio/Streamlit. Solo se hace UI si no consume tiempo de los experimentos.
