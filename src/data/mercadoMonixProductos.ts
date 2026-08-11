export interface ProductoMercado {
  id: string
  titulo: string
  precio: number
  cuotas: number
  envioGratis: boolean
  rating: number
  vendidos: number
  categoria: string
  tag?: string
}

/** Imágenes locales en /public/mercado — cargan siempre offline. */
export function productoImagen(p: Pick<ProductoMercado, 'id'>) {
  return `/mercado/${p.id}.jpg`
}

export const CATEGORIAS_MERCADO = [
  'Todas',
  'Tecnología',
  'Moda',
  'Hogar',
  'Deportes',
  'Belleza',
  'Gaming',
  'Automotriz',
] as const

export const PRODUCTOS_MERCADO: ProductoMercado[] = [
  { id: 't01', titulo: 'Auriculares inalámbricos MONIX Sound Pro ANC', precio: 89999, cuotas: 6, envioGratis: true, rating: 4.8, vendidos: 1240, categoria: 'Tecnología', tag: 'Más vendido' },
  { id: 't02', titulo: 'Smartwatch Fit Pulse GPS y monitor cardíaco', precio: 129999, cuotas: 9, envioGratis: true, rating: 4.6, vendidos: 820, categoria: 'Tecnología' },
  { id: 't03', titulo: 'Parlante Bluetooth waterproof 20W MONIX Boom', precio: 67999, cuotas: 6, envioGratis: true, rating: 4.9, vendidos: 1560, categoria: 'Tecnología', tag: 'Full' },
  { id: 't04', titulo: 'Mouse gamer RGB 16000 DPI ergonómico', precio: 34999, cuotas: 3, envioGratis: true, rating: 4.5, vendidos: 2340, categoria: 'Tecnología' },
  { id: 't05', titulo: 'Teclado mecánico switch red retroiluminado', precio: 95999, cuotas: 6, envioGratis: true, rating: 4.7, vendidos: 980, categoria: 'Tecnología', tag: 'Oferta' },
  { id: 't06', titulo: 'Monitor LED 27" Full HD 144Hz borde fino', precio: 289999, cuotas: 12, envioGratis: true, rating: 4.6, vendidos: 640, categoria: 'Tecnología' },
  { id: 't07', titulo: 'Notebook 15.6" Ryzen 5 16GB 512GB SSD', precio: 899999, cuotas: 12, envioGratis: true, rating: 4.7, vendidos: 410, categoria: 'Tecnología', tag: 'Full' },
  { id: 't08', titulo: 'Tablet 10.1" 128GB WiFi + funda MONIX', precio: 249999, cuotas: 9, envioGratis: true, rating: 4.4, vendidos: 720, categoria: 'Tecnología' },
  { id: 't09', titulo: 'Cargador portátil 20000mAh carga rápida', precio: 42999, cuotas: 3, envioGratis: true, rating: 4.8, vendidos: 3100, categoria: 'Tecnología' },
  { id: 't10', titulo: 'Cámara web Full HD 1080p con micrófono', precio: 38999, cuotas: 3, envioGratis: false, rating: 4.3, vendidos: 890, categoria: 'Tecnología' },
  { id: 't11', titulo: 'Disco SSD externo 1TB USB-C', precio: 119999, cuotas: 6, envioGratis: true, rating: 4.8, vendidos: 1320, categoria: 'Tecnología' },
  { id: 't12', titulo: 'Router WiFi 6 dual band AX3000', precio: 109999, cuotas: 6, envioGratis: true, rating: 4.5, vendidos: 560, categoria: 'Tecnología' },
  { id: 't13', titulo: 'Impresora multifunción WiFi tinta continua', precio: 279999, cuotas: 12, envioGratis: false, rating: 4.2, vendidos: 390, categoria: 'Tecnología' },
  { id: 't14', titulo: 'Lámpara LED escritorio con USB y dimmer', precio: 24999, cuotas: 3, envioGratis: true, rating: 4.6, vendidos: 1870, categoria: 'Tecnología' },
  { id: 't15', titulo: 'Proyector portátil Full HD nativo', precio: 349999, cuotas: 12, envioGratis: true, rating: 4.4, vendidos: 275, categoria: 'Tecnología', tag: 'Oferta' },

  { id: 'm01', titulo: 'Zapatillas Urban Run edición MONIX', precio: 74999, cuotas: 6, envioGratis: true, rating: 4.7, vendidos: 2103, categoria: 'Moda', tag: 'Oferta' },
  { id: 'm02', titulo: 'Mochila antirobo con puerto USB', precio: 45999, cuotas: 3, envioGratis: true, rating: 4.4, vendidos: 980, categoria: 'Moda' },
  { id: 'm03', titulo: 'Campera rompeviento unisex impermeable', precio: 89999, cuotas: 6, envioGratis: true, rating: 4.5, vendidos: 760, categoria: 'Moda' },
  { id: 'm04', titulo: 'Jean slim fit stretch azul oscuro', precio: 52999, cuotas: 3, envioGratis: true, rating: 4.3, vendidos: 1450, categoria: 'Moda' },
  { id: 'm05', titulo: 'Remera oversize algodón premium pack x2', precio: 32999, cuotas: 3, envioGratis: true, rating: 4.6, vendidos: 2890, categoria: 'Moda', tag: 'Más vendido' },
  { id: 'm06', titulo: 'Zapatos oxford cuero ecológico', precio: 99999, cuotas: 6, envioGratis: false, rating: 4.4, vendidos: 420, categoria: 'Moda' },
  { id: 'm07', titulo: 'Cartera bandolera vegan leather', precio: 61999, cuotas: 6, envioGratis: true, rating: 4.7, vendidos: 1100, categoria: 'Moda' },
  { id: 'm08', titulo: 'Gorra trucker MONIX mint/navy', precio: 18999, cuotas: 3, envioGratis: true, rating: 4.5, vendidos: 3200, categoria: 'Moda' },
  { id: 'm09', titulo: 'Buzo hoodie felpa pesada unisex', precio: 67999, cuotas: 6, envioGratis: true, rating: 4.8, vendidos: 1680, categoria: 'Moda', tag: 'Full' },
  { id: 'm10', titulo: 'Cinturón cuero genuino hebilla mate', precio: 27999, cuotas: 3, envioGratis: false, rating: 4.2, vendidos: 540, categoria: 'Moda' },
  { id: 'm11', titulo: 'Anteojos de sol polarizados UV400', precio: 35999, cuotas: 3, envioGratis: true, rating: 4.6, vendidos: 990, categoria: 'Moda' },
  { id: 'm12', titulo: 'Camisa oxford slim fit manga larga', precio: 44999, cuotas: 3, envioGratis: true, rating: 4.3, vendidos: 870, categoria: 'Moda' },

  { id: 'h01', titulo: 'Cafetera espresso compacta 15 bar', precio: 159999, cuotas: 12, envioGratis: false, rating: 4.5, vendidos: 430, categoria: 'Hogar' },
  { id: 'h02', titulo: 'Aspiradora robot con mapeo láser', precio: 399999, cuotas: 12, envioGratis: true, rating: 4.6, vendidos: 510, categoria: 'Hogar', tag: 'Full' },
  { id: 'h03', titulo: 'Set sábanas algodón 200 hilos queen', precio: 79999, cuotas: 6, envioGratis: true, rating: 4.7, vendidos: 1900, categoria: 'Hogar' },
  { id: 'h04', titulo: 'Freidora de aire 5.5L digital', precio: 149999, cuotas: 9, envioGratis: true, rating: 4.8, vendidos: 2400, categoria: 'Hogar', tag: 'Más vendido' },
  { id: 'h05', titulo: 'Licuadora vaso de vidrio 1200W', precio: 89999, cuotas: 6, envioGratis: true, rating: 4.4, vendidos: 780, categoria: 'Hogar' },
  { id: 'h06', titulo: 'Juego de ollas antiadherente 8 piezas', precio: 129999, cuotas: 9, envioGratis: false, rating: 4.5, vendidos: 650, categoria: 'Hogar' },
  { id: 'h07', titulo: 'Almohada viscoelástica memory foam', precio: 39999, cuotas: 3, envioGratis: true, rating: 4.6, vendidos: 2200, categoria: 'Hogar' },
  { id: 'h08', titulo: 'Humidificador ultrasónico aromaterapia', precio: 45999, cuotas: 3, envioGratis: true, rating: 4.3, vendidos: 910, categoria: 'Hogar' },
  { id: 'h09', titulo: 'Lámpara de pie arco LED regulable', precio: 119999, cuotas: 6, envioGratis: true, rating: 4.5, vendidos: 340, categoria: 'Hogar' },
  { id: 'h10', titulo: 'Organizador closet 12 cubos tela', precio: 29999, cuotas: 3, envioGratis: true, rating: 4.2, vendidos: 1750, categoria: 'Hogar', tag: 'Oferta' },
  { id: 'h11', titulo: 'Pava eléctrica acero inox 1.7L', precio: 54999, cuotas: 3, envioGratis: true, rating: 4.7, vendidos: 1340, categoria: 'Hogar' },
  { id: 'h12', titulo: 'Set toallas baño 100% algodón x4', precio: 48999, cuotas: 3, envioGratis: true, rating: 4.4, vendidos: 860, categoria: 'Hogar' },

  { id: 'd01', titulo: 'Bicicleta mountain bike rodado 29', precio: 549999, cuotas: 12, envioGratis: false, rating: 4.6, vendidos: 220, categoria: 'Deportes', tag: 'Full' },
  { id: 'd02', titulo: 'Mancuernas hexagonales 10kg par', precio: 69999, cuotas: 6, envioGratis: true, rating: 4.8, vendidos: 1500, categoria: 'Deportes' },
  { id: 'd03', titulo: 'Colchoneta yoga antideslizante 10mm', precio: 24999, cuotas: 3, envioGratis: true, rating: 4.5, vendidos: 2600, categoria: 'Deportes' },
  { id: 'd04', titulo: 'Pelota fútbol oficial N°5 cosida', precio: 32999, cuotas: 3, envioGratis: true, rating: 4.4, vendidos: 980, categoria: 'Deportes' },
  { id: 'd05', titulo: 'Cuerda para saltar con contador digital', precio: 15999, cuotas: 3, envioGratis: true, rating: 4.3, vendidos: 1800, categoria: 'Deportes', tag: 'Oferta' },
  { id: 'd06', titulo: 'Botella térmica acero 750ml MONIX', precio: 28999, cuotas: 3, envioGratis: true, rating: 4.7, vendidos: 2100, categoria: 'Deportes' },
  { id: 'd07', titulo: 'Bandas elásticas resistencia set x5', precio: 21999, cuotas: 3, envioGratis: true, rating: 4.6, vendidos: 1430, categoria: 'Deportes' },
  { id: 'd08', titulo: 'Casco ciclismo con luz LED trasera', precio: 59999, cuotas: 6, envioGratis: true, rating: 4.5, vendidos: 470, categoria: 'Deportes' },

  { id: 'b01', titulo: 'Secador profesional iónico 2200W', precio: 79999, cuotas: 6, envioGratis: true, rating: 4.6, vendidos: 1120, categoria: 'Belleza' },
  { id: 'b02', titulo: 'Plancha de pelo titanio LCD', precio: 69999, cuotas: 6, envioGratis: true, rating: 4.5, vendidos: 890, categoria: 'Belleza', tag: 'Oferta' },
  { id: 'b03', titulo: 'Set skincare facial 5 pasos', precio: 45999, cuotas: 3, envioGratis: true, rating: 4.7, vendidos: 1670, categoria: 'Belleza' },
  { id: 'b04', titulo: 'Afeitadora eléctrica wet & dry', precio: 119999, cuotas: 9, envioGratis: true, rating: 4.4, vendidos: 540, categoria: 'Belleza' },
  { id: 'b05', titulo: 'Perfume unisex eau de parfum 100ml', precio: 89999, cuotas: 6, envioGratis: false, rating: 4.8, vendidos: 2300, categoria: 'Belleza', tag: 'Más vendido' },
  { id: 'b06', titulo: 'Masajeador facial LED terapia', precio: 54999, cuotas: 3, envioGratis: true, rating: 4.3, vendidos: 610, categoria: 'Belleza' },

  { id: 'g01', titulo: 'Joystick inalámbrico compatible PC/TV', precio: 79999, cuotas: 6, envioGratis: true, rating: 4.7, vendidos: 1980, categoria: 'Gaming', tag: 'Full' },
  { id: 'g02', titulo: 'Silla gamer ergonómica reclining', precio: 289999, cuotas: 12, envioGratis: false, rating: 4.5, vendidos: 730, categoria: 'Gaming' },
  { id: 'g03', titulo: 'Headset 7.1 surround micrófono RGB', precio: 99999, cuotas: 6, envioGratis: true, rating: 4.6, vendidos: 1410, categoria: 'Gaming' },
  { id: 'g04', titulo: 'Mousepad XL antideslizante 90x40', precio: 19999, cuotas: 3, envioGratis: true, rating: 4.8, vendidos: 3500, categoria: 'Gaming', tag: 'Oferta' },
  { id: 'g05', titulo: 'Consola retro 10000 juegos HDMI', precio: 64999, cuotas: 6, envioGratis: true, rating: 4.2, vendidos: 920, categoria: 'Gaming' },
  { id: 'g06', titulo: 'Streaming mic USB condensador', precio: 109999, cuotas: 6, envioGratis: true, rating: 4.7, vendidos: 480, categoria: 'Gaming' },
  { id: 'g07', titulo: 'Luz ring LED 10" con trípode', precio: 42999, cuotas: 3, envioGratis: true, rating: 4.5, vendidos: 1600, categoria: 'Gaming' },
  { id: 'g08', titulo: 'Volante racing con pedales PC', precio: 249999, cuotas: 12, envioGratis: false, rating: 4.4, vendidos: 210, categoria: 'Gaming' },

  { id: 'a01', titulo: 'Soporte celular magnético auto ventilación', precio: 18999, cuotas: 3, envioGratis: true, rating: 4.6, vendidos: 4100, categoria: 'Automotriz', tag: 'Más vendido' },
  { id: 'a02', titulo: 'Cargador auto USB-C PD 45W dual', precio: 22999, cuotas: 3, envioGratis: true, rating: 4.7, vendidos: 2800, categoria: 'Automotriz' },
  { id: 'a03', titulo: 'Aspiradora portátil 120W para auto', precio: 49999, cuotas: 3, envioGratis: true, rating: 4.4, vendidos: 950, categoria: 'Automotriz' },
  { id: 'a04', titulo: 'Kit emergencia vial 5 en 1', precio: 35999, cuotas: 3, envioGratis: true, rating: 4.5, vendidos: 670, categoria: 'Automotriz' },
  { id: 'a05', titulo: 'Cubreasientos universales neoprene', precio: 79999, cuotas: 6, envioGratis: false, rating: 4.3, vendidos: 540, categoria: 'Automotriz' },
  { id: 'a06', titulo: 'Dashcam Full HD visión nocturna', precio: 99999, cuotas: 6, envioGratis: true, rating: 4.6, vendidos: 820, categoria: 'Automotriz', tag: 'Full' },
  { id: 'a07', titulo: 'Compresor de aire portátil 12V', precio: 54999, cuotas: 3, envioGratis: true, rating: 4.5, vendidos: 1100, categoria: 'Automotriz' },
  { id: 'a08', titulo: 'Ambientador clip set x6 aromas', precio: 9999, cuotas: 3, envioGratis: true, rating: 4.1, vendidos: 5200, categoria: 'Automotriz', tag: 'Oferta' },
]
