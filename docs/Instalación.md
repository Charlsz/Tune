# Instalacion de Tune

Tune analiza inundacion en imagenes satelitales con el checkpoint Prithvi-EO 2.0 de Sen1Floods11.

## Requisitos

Git y Docker con Docker Compose. CPU basta. GPU es opcional.

## Levantar, ver logs y apagar

```bash
git clone https://github.com/Charlsz/Tune.git
cd Tune
cp .env.example .env
make app-up
make app-logs
make app-down
```

make app-up construye y levanta la API y la web. La web queda en http://localhost:8080 y la API en http://localhost:8000/docs.

make app-logs muestra los logs de la API en tiempo real. En la primera inferencia se descargan alrededor de 1,2 GB de pesos. Quedan cacheados para las siguientes corridas.

make app-down detiene y elimina los contenedores. Los analisis en disco y la cache de pesos se conservan.

## Desarrollo local opcional

Para trabajar el codigo sin Docker, crear un entorno virtual, instalar el paquete con extras api y dev, y ejecutar pytest. El frontend en modo desarrollo usa npm run dev con la API en el puerto 8000. El detalle de arquitectura esta en docs/architecture/v2.md.
