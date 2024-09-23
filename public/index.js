const express = require('express');
const app = express();
const axios = require('axios');
const path = require('path');
const PORT = 3000;
const limite = 20;

const departamentosAPI = 'https://collectionapi.metmuseum.org/public/collection/v1/departments';
const ubicaciones = ["Europe", "France", "Paris", "China", "New York", "Japan"];
//imagen por defecto
const sinImg = '/assets/sinIMG.png';

//parametros de PUG busnca la carpeta views
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let datosApiEnCache = [];
let datosApiEnCacheTotales = 0; // Número total de resultados


app.get('/verDetalle/:id', async (req, res) => {
    const { id } = req.params;

    
    const datos = await axios.get(departamentosAPI);
    const departamentos = datos.data.departments;

    try {
        const response = await axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        const objeto = response.data;
        const imagenesAdicionales = objeto.additionalImages && objeto.additionalImages.length > 0 ? objeto.additionalImages : null;
        res.render('detalle', { departamentos, ubicaciones, objeto, imagenesAdicionales });
    } catch (error) {
        console.error(`Error al obtener detalles del objeto con ID ${id}:`, error.message);
        res.status(500).send('Error obteniendo detalles del objeto');
    }

});

app.get('/', async (req, res) => {

    const pagina = req.query.pagina ? parseInt(req.query.pagina) : 1;
    const paginaTotal = Math.ceil(datosApiEnCacheTotales / limite);
    const inicioIndex = (pagina - 1) * limite;
    const finIndex = inicioIndex + limite;
    const paginatedData = datosApiEnCache.slice(inicioIndex, finIndex);

    console.log("--------------------------------------");
    console.log(pagina);
    console.log(limite);
    console.log(paginaTotal);
    console.log(inicioIndex);
    console.log(finIndex);
    console.log(paginatedData.length);
    console.log(datosApiEnCache.length);

    try {
        const datos = await axios.get(departamentosAPI);
        const departamentos = datos.data.departments;
        if (datosApiEnCache.length === 0) {
            //filtro por primera vez los primeros 20
            //selecciono un departamento para q no traiga todos
            const pedirDatosApi = await axios.get('https://collectionapi.metmuseum.org/public/collection/v1/objects?hasImages=true&departmentIds=6');
            //obtengo solo 20 del total obtenido
            const soloIds = pedirDatosApi.data.objectIDs ? pedirDatosApi.data.objectIDs.slice(0, 20) : [];

            //al obtener los ids ahora tengo q llenar con sus datos y validad dinastia y cultura con foto
            const promises = soloIds.map(id =>
                axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
                    .then(response => {
                        const obj = response.data;
                        return {
                            ...obj,
                            dynasty: obj.dynasty ? obj.dynasty : 'Sin dinastía',
                            culture: obj.culture ? obj.culture : 'Sin cultura',
                            primaryImageSmall: obj.primaryImageSmall ? obj.primaryImageSmall : sinImg
                        };
                    })
            );
            //los primero 20 objetos completos con sus datos
            const soloIdsObjetos = await Promise.all(promises);

            res.render('index', { departamentos, ubicaciones, objetos: soloIdsObjetos, paginaActual: 1, paginaTotal: 1 });
        } else {
            const paginacionDatos = datosApiEnCache.slice(inicioIndex, finIndex);

            res.render('index', { departamentos, ubicaciones, objetos: paginacionDatos, paginaActual: pagina, paginaTotal });
        }



    } catch (error) {
        res.status(500).send('Error no se pueden traer los depas');
    }
});

app.post('/', async (req, res) => {
    let { palabraClave, departamento, ubicacion } = req.body;

    let filtroApiUrl = "https://collectionapi.metmuseum.org/public/collection/v1/search?";

    if (!palabraClave || palabraClave.trim() === "") {
        palabraClave = '""';
    } else {
        filtroApiUrl += `title=true`;
    }

    if (departamento) {
        filtroApiUrl += `&departmentId=${departamento}`;
    }
    if (ubicacion) {
        filtroApiUrl += `&geoLocation=${ubicacion}`;
    }

    //VALIDAR SI NO PUSISTE NADA
    if (filtroApiUrl === "https://collectionapi.metmuseum.org/public/collection/v1/search?") {
        return res.status(500).send('USAR FILTROS');
    }
    filtroApiUrl += `&q=${palabraClave}`;

    console.log(filtroApiUrl);

    try {
        const datosFiltrados = await axios.get(filtroApiUrl);
        const soloIdsFiltrados = datosFiltrados.data.objectIDs.slice(0, 60) || [];

        // Al obtener los ids ahora llenamos con sus datos y validamos dinastía, cultura y foto
        const promises = soloIdsFiltrados.map(id =>
            axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
                .then(response => {
                    const obj = response.data;
                    return {
                        ...obj,
                        dynasty: obj.dynasty ? obj.dynasty : 'Sin dinastía',
                        culture: obj.culture ? obj.culture : 'Sin cultura',
                        primaryImageSmall: obj.primaryImageSmall ? obj.primaryImageSmall : sinImg
                    };
                })
                .catch(error => {
                    if (error.response && error.response.status === 404) {
                        console.log(`objeto ${id} no encontrado`);
                        return null;
                    }
                    console.error(`error id ${id}:`, error.message);
                    return null;
                })
        );

        const soloIdsDatos = await Promise.all(promises);
        //omitir nulos
        datosApiEnCache = soloIdsDatos.filter(obj => obj !== null);
        datosApiEnCacheTotales = datosApiEnCache.length;
        const paginaTotal = Math.ceil(datosApiEnCacheTotales / limite);

        const datos = await axios.get(departamentosAPI);
        const departamentos = datos.data.departments;
        let paginacionDatos = [];
        if(datosApiEnCache!=0){
            paginacionDatos = datosApiEnCache.slice(0, 20);
        }

        res.render('index', { departamentos, ubicaciones, objetos: paginacionDatos, paginaActual: 1, paginaTotal });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error de datos');
    }
});



app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}}`);
});
