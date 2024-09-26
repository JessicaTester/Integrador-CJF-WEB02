const express = require('express');
const app = express();
const axios = require('axios');
const path = require('path');
const PORT = process.env.PORT || 3000;
const limite = 20;
const translate = require('node-google-translate-skidz');

const departamentosAPI = 'https://collectionapi.metmuseum.org/public/collection/v1/departments';
const ubicaciones = ["Africa", "Europe", "France", "Paris", "China", "New York", "Japan"];
//imagen por defecto
const sinImg = '/assets/sinIMG.png';
console.log(__dirname);
console.log(sinImg);

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public/assets')));

//parametros de PUG busnca la carpeta views
app.set('view engine', 'pug');
app.set('views', path.join(__dirname + "/public", 'views'));

let datosApiEnCache = [];
let datosApiEnCacheTotales = 0; // Número total de resultados

app.get('/verDetalle/:id', async (req, res) => {
    const { id } = req.params;

    const datos = await axios.get(departamentosAPI);
    const departamentos = datos.data.departments;

    try {
        //busco el objeto en el arreglo datosApiEnCache en vez de pedirlo, desventajas?
        //const response = await axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        //const objeto = response.data;
        const objeto = datosApiEnCache.find(o => o.objectID == id);
        const imagenesAdicionales = objeto.additionalImages && objeto.additionalImages.length > 0 ? objeto.additionalImages : null;
        objeto.primaryImage = objeto.primaryImage ? objeto.primaryImage : sinImg
        res.render('detalle', { departamentos, ubicaciones, objeto, imagenesAdicionales });
    } catch (error) {
        console.error(`error al obtener detalles del objeto: ${id}:`, error.message);
        res.status(500).send('error obteniendo detalles del objeto');
    }

});


app.get('/', async (req, res) => {

    const pagina = req.query.pagina ? parseInt(req.query.pagina) : 1;
    const paginaTotal = Math.ceil(datosApiEnCacheTotales / limite);
    const inicioIndex = (pagina - 1) * limite;
    const finIndex = inicioIndex + limite;

    try {
        const datos = await axios.get(departamentosAPI);
        const departamentos = datos.data.departments;
        if (datosApiEnCache.length === 0) {
            console.log("Paso por 00000")
            //filtro por primera vez los primeros 20
            //selecciono un departamento para q no traiga todos
            const pedirDatosApi = await axios.get('https://collectionapi.metmuseum.org/public/collection/v1/search?isHighlight=true&hasImages=true&q=""');
            //obtengo solo 20 del total obtenido
            const soloIdsFiltrados = pedirDatosApi.data.objectIDs.slice(0, 20) || [];

            //al obtener los ids ahora tengo q llenar con sus datos y validad dinastia y cultura con foto
            const promesa = soloIdsFiltrados.map(id =>
                axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
                    .then(response => {
                        const obj = response.data;
                        return {
                            ...obj,
                            title: obj.title ? obj.title : 'Sin titulo',
                            dynasty: obj.dynasty ? obj.dynasty : 'Sin dinastía',
                            culture: obj.culture ? obj.culture : 'Sin cultura',
                            primaryImageSmall: obj.primaryImageSmall ? obj.primaryImageSmall : sinImg
                        };
                    })
            );

            const soloIdsDatos = await Promise.all(promesa);
            if (soloIdsDatos.length != 0) {
                //omitir nulos
                datosApiEnCache = soloIdsDatos.filter(obj => obj !== null);
                //traducir
                datosApiEnCache = await traducirEsp(datosApiEnCache, "es");
            }

            res.render('index', { departamentos, ubicaciones, objetos: datosApiEnCache, paginaActual: 1, paginaTotal: 1 });

        } else {
            const paginacionDatos = datosApiEnCache.slice(inicioIndex, finIndex);
            res.render('index', { departamentos, ubicaciones, objetos: paginacionDatos, paginaActual: pagina, paginaTotal });
        }

    } catch (error) {
        res.status(500).send('error no se pueden traer los depas');
    }
});

app.post('/', async (req, res) => {
    let { palabraClave, departamento, ubicacion } = req.body;
    let paginacionDatos = [];
    let paginaTotal = 0;
    const datos = await axios.get(departamentosAPI);
    const departamentos = datos.data.departments;
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

    filtroApiUrl += `&q=${palabraClave}`;

    console.log(filtroApiUrl);

    try {
        const datosFiltrados = await axios.get(filtroApiUrl);
        let soloIdsFiltrados = [];
        if (datosFiltrados.data.total != 0) {
            soloIdsFiltrados = datosFiltrados.data.objectIDs.slice(0, 60) || [];
        }
        // Al obtener los ids ahora llenamos con sus datos y validamos dinastía, cultura y foto
        const promesa = soloIdsFiltrados.map(id =>
            axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
                .then(response => {
                    const obj = response.data;
                    return {
                        ...obj,
                        title: obj.title ? obj.title : 'Sin titulo',
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
        const soloIdsDatos = await Promise.all(promesa);

        if (soloIdsDatos.length != 0) {
            //omitir nulos
            datosApiEnCache = soloIdsDatos.filter(obj => obj !== null);
            //traducir
            datosApiEnCache = await traducirEsp(datosApiEnCache, "es");
            datosApiEnCacheTotales = datosApiEnCache.length;
            paginaTotal = Math.ceil(datosApiEnCacheTotales / limite);
            paginacionDatos = datosApiEnCache.slice(0, 20);
        }

        res.render('index', { departamentos, ubicaciones, objetos: paginacionDatos, paginaActual: 1, paginaTotal, palabraClave, departamento, ubicacion });
    } catch (error) {
        console.log(error);
        res.status(500).send('error de datos');
    }
});

async function traducirEsp(objetos, idioma) {
    const textoPlano = objetos.map(item => `${item.title}\n${item.dynasty}\n${item.culture}`).join('\n');
    const traducionTextoPlano = await translate({
        text: textoPlano,
        source: 'en',
        target: idioma
    });

    const traducionLimpia = traducionTextoPlano.translation.split('\n');
    let index = 0;
    objetos.forEach(item => {
        item.tituloEsp = traducionLimpia[index++];
        item.dinastiaEsp = traducionLimpia[index++];
        item.culturaEsp = traducionLimpia[index++];
    });
    return objetos;
}

app.use(async (req, res, next) => {
    try {
        const datos = await axios.get(departamentosAPI);
        const departamentos = datos.data.departments;
        res.status(404).render('404', { departamentos, ubicaciones });
    } catch (error) {
        next(error);
    }
});

app.listen(PORT, () => {
    console.log(`servidor funcionando en http://localhost:${PORT}}`);
});
