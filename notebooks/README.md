# notebooks/

Exploración y smoke tests (Colab / Kaggle / local). Regla del plan: los notebooks
exploran; la lógica reutilizable vive en `src/tune/`.

Convención de nombres: `NN-tema.ipynb` (p. ej. `01-explore-dataset.ipynb`,
`02-baseline-smoke.ipynb`). Limpiar outputs pesados antes de commitear.

Para usar el paquete desde Colab:

```python
!git clone https://github.com/Charlsz/Tune && pip install -e Tune[training,tracking]
```
