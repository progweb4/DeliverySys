// js/app.js

document.addEventListener('DOMContentLoaded', () => {

    // --- CONSTANTES Y ESTADO DE LA APLICACIÓN ---
    // ¡IMPORTANTE!: Cambia esta URL en producción si es diferente
    const API_URL = 'http://localhost/delivery-app/api/';
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const appContent = document.getElementById('app-content');
    const navLinks = document.querySelectorAll('.nav-link');
    const logoutButton = document.getElementById('logout-button');
    const notificationArea = document.getElementById('notification-area'); // Nuevo elemento para notificaciones

    // Estado global de la aplicación
    let pedidos = [];
    let repartidores = [];
    let productos = [];
    let clientes = [];
    let carrito = []; // Carrito de compras para crear nuevo pedido

    // --- FUNCIONES DE UTILIDAD (NOTIFICACIONES) ---
    function showNotification(message, type = 'success') {
        notificationArea.innerHTML = `<div class="p-3 rounded-lg ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${message}</div>`;
        notificationArea.style.display = 'block';
        setTimeout(() => {
            notificationArea.style.display = 'none';
            notificationArea.innerHTML = '';
        }, 5000); // Ocultar después de 5 segundos
    }

// --- FUNCIÓN PARA CAMBIAR ESTADO DE REPARTIDOR ---
/**
 * Cambia el estado (disponible/ocupado) de un repartidor a través de la API.
 * @param {number} id - El ID del repartidor.
 * @param {string} newStatus - El nuevo estado ('disponible' o 'ocupado').
 */
async function toggleRepartidorStatus(id, newStatus) {
    const url = `${API_URL}repartidor_estado.php`;
    const token = localStorage.getItem('authToken');

    if (!token) {
        showNotification('Sesión expirada o no iniciada.', 'error');
        return;
    }
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id_repartidor: id,
                estado: newStatus
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(data.message, 'success');
            // Opcional: Re-renderizar la vista de repartidores o solo el botón
            if (window.location.hash === '#repartidores') {
                 // Esto forzará una recarga de datos si es necesario
            }
        } else {
            showNotification(data.message || 'Error al actualizar estado del repartidor.', 'error');
        }
    } catch (error) {
        console.error('Error al cambiar el estado del repartidor:', error);
        showNotification('Error de conexión al intentar cambiar el estado.', 'error');
    }
}
// ...

    // --- FUNCIONES DE API GENÉRICAS ---
    async function apiRequest(endpoint, method = 'GET', data = null, id = null) {
        try {
            const token = localStorage.getItem('authToken');
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            let url = `${API_URL}${endpoint}`;
            if (id && (method === 'GET' || method === 'DELETE')) { // Para GET (single) o DELETE con ID en URL
                url += `?id=${id}`;
            }

            const config = {
                method: method,
                headers: headers,
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) { // DELETE ahora envía cuerpo
                config.body = JSON.stringify(data);
            }

            const response = await fetch(url, config);
            const result = await response.json();

            if (!response.ok) {
                // Si la respuesta es 401 Unauthorized (o cualquier error de autenticación/autorización)
                // y el token existe, podría significar que el token expiró o es inválido.
                if (response.status === 401 || response.status === 403) {
                    showNotification('Su sesión ha expirado o no está autorizado. Por favor, inicie sesión nuevamente.', 'error');
                    logoutUser(); // Forzar cierre de sesión
                    return null;
                }
                throw new Error(result.message || `Error HTTP: ${response.status}`);
            }
            return result;
        } catch (error) {
            console.error(`Error en la petición a ${endpoint} (${method}):`, error);
            showNotification(`Error de comunicación con el servidor: ${error.message}`, 'error');
            return null;
        }
    }

    // --- FUNCIONES ESPECÍFICAS PARA CADA RECURSO DE LA API ---

    // Pedidos
    async function getPedidos() {
        pedidos = await apiRequest('pedidos.php', 'GET');
        return pedidos || [];
    }

    async function getSinglePedido(id) {
        return await apiRequest('pedidos.php', 'GET', null, id);
    }

    async function createPedido(id_cliente, detalles) {
        const response = await apiRequest('pedidos_crear.php', 'POST', { id_cliente, detalles });
        if (response) {
            showNotification('Pedido creado exitosamente.');
            await getPedidos(); // Recargar la lista de pedidos
        }
        return response;
    }

    async function updatePedidoStatus(id_pedido, nuevo_estado, id_repartidor = null, id_repartidor_anterior = null) {
        const data = { id_pedido, nuevo_estado };
        if (id_repartidor) data.id_repartidor = id_repartidor;
        if (id_repartidor_anterior) data.id_repartidor_anterior = id_repartidor_anterior;

        const response = await apiRequest('pedidos_acciones.php', 'PUT', data);
        if (response) {
            showNotification('Estado del pedido actualizado.');
            await getPedidos(); // Recargar la lista
        }
        return response;
    }

    // Repartidores
    async function getRepartidores() {
        repartidores = await apiRequest('repartidores.php', 'GET');
        return repartidores || [];
    }

    async function getSingleRepartidor(id) {
        return await apiRequest('repartidores.php', 'GET', null, id);
    }

    async function createRepartidor(nombre_completo, telefono, vehiculo, estado = 'disponible') {
        const response = await apiRequest('repartidores.php', 'POST', { nombre_completo, telefono, vehiculo, estado });
        if (response) {
            showNotification('Repartidor creado exitosamente.');
            await getRepartidores();
        }
        return response;
    }

    async function updateRepartidor(id_repartidor, nombre_completo, telefono, vehiculo, estado) {
        const response = await apiRequest('repartidores.php', 'PUT', { id_repartidor, nombre_completo, telefono, vehiculo, estado });
        if (response) {
            showNotification('Repartidor actualizado exitosamente.');
            await getRepartidores();
        }
        return response;
    }

    async function deleteRepartidor(id_repartidor) {
        // DELETE con ID en el cuerpo
        const response = await apiRequest('repartidores.php', 'DELETE', { id_repartidor });
        if (response) {
            showNotification('Repartidor eliminado exitosamente.');
            await getRepartidores();
        }
        return response;
    }

    // Productos
    async function getProductos() {
        productos = await apiRequest('productos.php', 'GET');
        return productos || [];
    }

    async function getSingleProducto(id) {
        return await apiRequest('productos.php', 'GET', null, id);
    }

    async function createProducto(nombre_producto, descripcion, precio, stock, categoria) {
        const response = await apiRequest('productos.php', 'POST', { nombre: nombre_producto, descripcion, precio, stock, categoria });
        if (response) {
            showNotification('Producto creado exitosamente.');
            await getProductos();
        }
        return response;
    }

    async function updateProducto(id, nombre_producto, descripcion, precio, stock, categoria) {
        const response = await apiRequest('productos.php', 'PUT', { id, nombre: nombre_producto, descripcion, precio, stock, categoria });
        if (response) {
            showNotification('Producto actualizado exitosamente.');
            await getProductos();
        }
        return response;
    }

    async function deleteProducto(id) {
        // DELETE con ID en el cuerpo
        const response = await apiRequest('productos.php', 'DELETE', { id });
        if (response) {
            showNotification('Producto eliminado exitosamente.');
            await getProductos();
        }
        return response;
    }

    // Clientes
    async function getClientes() {
        clientes = await apiRequest('clientes.php', 'GET');
        return clientes || [];
    }

    async function getSingleCliente(id) {
        return await apiRequest('clientes.php', 'GET', null, id);
    }

    async function createCliente(nombre_completo, direccion, telefono) {
        const response = await apiRequest('clientes.php', 'POST', { nombre_completo, direccion, telefono });
        if (response) {
            showNotification('Cliente creado exitosamente.');
            await getClientes();
        }
        return response;
    }

    async function updateCliente(id_cliente, nombre_completo, direccion, telefono) {
        const response = await apiRequest('clientes.php', 'PUT', { id_cliente, nombre_completo, direccion, telefono });
        if (response) {
            showNotification('Cliente actualizado exitosamente.');
            await getClientes();
        }
        return response;
    }

    async function deleteCliente(id_cliente) {
        // DELETE con ID en el cuerpo
        const response = await apiRequest('clientes.php', 'DELETE', { id_cliente });
        if (response) {
            showNotification('Cliente eliminado exitosamente.');
            await getClientes();
        }
        return response;
    }

    // --- RENDERIZADO DE VISTAS (esqueletos, ¡necesitas implementar el HTML!) ---
    async function renderPedidos() {
        const data = await getPedidos();
        let html = '<h1 class="text-3xl font-bold mb-6 text-gray-800">Gestión de Pedidos</h1>';
        html += '<div class="bg-white p-6 rounded-lg shadow-md">';
        if (data && data.length > 0) {
            html += '<table class="min-w-full divide-y divide-gray-200"><thead><tr>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Pedido</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repartidor</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>';
            html += '</tr></thead><tbody class="divide-y divide-gray-200">';
            data.forEach(pedido => {
                html += `<tr class="${pedido.estado_pedido === 'Entregado' ? 'bg-green-50' : ''} ${pedido.estado_pedido === 'Cancelado' ? 'bg-red-50' : ''}">`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${pedido.id_pedido}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${pedido.cliente_nombre || 'N/A'}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${pedido.repartidor_nombre || 'No asignado'}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${new Date(pedido.fecha_pedido).toLocaleDateString()}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${pedido.estado_pedido}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">$${parseFloat(pedido.total_pedido).toFixed(2)}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">
                            <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm" onclick="viewPedidoDetails(${pedido.id_pedido})">Ver</button>
                            <button class="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded text-sm ml-2" onclick="editPedidoStatus(${pedido.id_pedido}, '${pedido.estado_pedido}', ${pedido.id_repartidor || 'null'})">Cambiar Estado</button>
                         </td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-gray-600">No hay pedidos para mostrar.</p>';
        }
        html += '</div>';
        appContent.innerHTML = html;
    }

    async function renderRepartidores() {
        const data = await getRepartidores();
        let html = '<h1 class="text-3xl font-bold mb-6 text-gray-800">Gestión de Repartidores</h1>';
        html += '<button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4" onclick="showAddRepartidorForm()">Agregar Repartidor</button>';
        html += '<div class="bg-white p-6 rounded-lg shadow-md">';
        if (data && data.length > 0) {
            html += '<table class="min-w-full divide-y divide-gray-200"><thead><tr>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>';
            html += '</tr></thead><tbody class="divide-y divide-gray-200">';
            data.forEach(rep => {
                html += `<tr class="${rep.estado === 'ocupado' ? 'bg-orange-50' : 'bg-green-50'}">`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${rep.id_repartidor}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${rep.nombre_completo}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${rep.telefono}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${rep.vehiculo}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${rep.estado}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">
                            <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm" onclick="showEditRepartidorForm(${rep.id_repartidor})">Editar</button>
                            <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm ml-2" onclick="handleDeleteRepartidor(${rep.id_repartidor})">Eliminar</button>
                         </td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-gray-600">No hay repartidores para mostrar.</p>';
        }
        html += '</div>';
        appContent.innerHTML = html;
    }

    async function renderClientes() {
        const data = await getClientes();
        let html = '<h1 class="text-3xl font-bold mb-6 text-gray-800">Gestión de Clientes</h1>';
        html += '<button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4" onclick="showAddClienteForm()">Agregar Cliente</button>';
        html += '<div class="bg-white p-6 rounded-lg shadow-md">';
        if (data && data.length > 0) {
            html += '<table class="min-w-full divide-y divide-gray-200"><thead><tr>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>';
            html += '</tr></thead><tbody class="divide-y divide-gray-200">';
            data.forEach(cli => {
                html += `<tr>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${cli.id_cliente}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${cli.nombre_completo}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${cli.direccion}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${cli.telefono}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">
                            <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm" onclick="showEditClienteForm(${cli.id_cliente})">Editar</button>
                            <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm ml-2" onclick="handleDeleteCliente(${cli.id_cliente})">Eliminar</button>
                         </td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-gray-600">No hay clientes para mostrar.</p>';
        }
        html += '</div>';
        appContent.innerHTML = html;
    }

    async function renderProductos() {
        const data = await getProductos();
        let html = '<h1 class="text-3xl font-bold mb-6 text-gray-800">Gestión de Productos</h1>';
        html += '<button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4" onclick="showAddProductoForm()">Agregar Producto</button>';
        html += '<div class="bg-white p-6 rounded-lg shadow-md">';
        if (data && data.length > 0) {
            html += '<table class="min-w-full divide-y divide-gray-200"><thead><tr>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>';
            html += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>';
            html += '</tr></thead><tbody class="divide-y divide-gray-200">';
            data.forEach(prod => {
                html += `<tr>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${prod.id_producto}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${prod.nombre_producto}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${prod.descripcion || ''}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">$${parseFloat(prod.precio).toFixed(2)}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${prod.stock}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">${prod.categoria || 'N/A'}</td>`;
                html += `<td class="px-6 py-4 whitespace-nowrap">
                            <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm" onclick="showEditProductoForm(${prod.id_producto})">Editar</button>
                            <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm ml-2" onclick="handleDeleteProducto(${prod.id_producto})">Eliminar</button>
                         </td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-gray-600">No hay productos para mostrar.</p>';
        }
        html += '</div>';
        appContent.innerHTML = html;
    }

    async function renderNuevoPedido() {
        // Cargar clientes y productos para el formulario de nuevo pedido
        await getClientes();
        await getProductos();

        let html = '<h1 class="text-3xl font-bold mb-6 text-gray-800">Crear Nuevo Pedido</h1>';
        html += `<div class="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h2 class="text-xl font-semibold mb-4">Paso 1: Seleccionar Cliente</h2>
                    <select id="select-cliente" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="">Seleccione un cliente...</option>
                        ${clientes.map(c => `<option value="${c.id_cliente}">${c.nombre_completo} (${c.telefono})</option>`).join('')}
                    </select>
                </div>`;

        html += `<div class="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h2 class="text-xl font-semibold mb-4">Paso 2: Añadir Productos al Pedido</h2>
                    <div class="mb-4">
                        <select id="select-producto" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            <option value="">Seleccione un producto...</option>
                            ${productos.map(p => `<option value="${p.id_producto}" data-price="${p.precio}" data-stock="${p.stock}">${p.nombre_producto} ($${parseFloat(p.precio).toFixed(2)}) - Stock: ${p.stock}</option>`).join('')}
                        </select>
                        <input type="number" id="cantidad-producto" placeholder="Cantidad" class="mt-2 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" min="1" value="1">
                        <button id="add-to-cart-button" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Añadir al Carrito</button>
                    </div>

                    <h3 class="text-lg font-semibold mb-2">Carrito de Compras:</h3>
                    <div id="cart-items" class="border border-gray-200 rounded-lg p-3 min-h-[100px]">
                        ${carrito.length === 0 ? '<p class="text-gray-500">El carrito está vacío.</p>' : ''}
                    </div>
                    <p class="text-right text-xl font-bold mt-4">Total: $<span id="cart-total">${calculateCartTotal().toFixed(2)}</span></p>
                </div>`;

        html += `<div class="bg-white p-6 rounded-lg shadow-md">
                    <h2 class="text-xl font-semibold mb-4">Paso 3: Finalizar Pedido</h2>
                    <button id="submit-pedido-button" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold w-full">
                        Crear Pedido
                    </button>
                </div>`;

        appContent.innerHTML = html;

        // Añadir listeners para el formulario de nuevo pedido
        const selectProducto = document.getElementById('select-producto');
        const cantidadProducto = document.getElementById('cantidad-producto');
        const addToCartButton = document.getElementById('add-to-cart-button');
        const cartItemsDiv = document.getElementById('cart-items');
        const cartTotalSpan = document.getElementById('cart-total');
        const submitPedidoButton = document.getElementById('submit-pedido-button');
        const selectCliente = document.getElementById('select-cliente');

        function updateCartDisplay() {
            cartItemsDiv.innerHTML = '';
            if (carrito.length === 0) {
                cartItemsDiv.innerHTML = '<p class="text-gray-500">El carrito está vacío.</p>';
            } else {
                carrito.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0';
                    itemDiv.innerHTML = `
                        <span>${item.nombre_producto} x ${item.cantidad} ($${item.precio.toFixed(2)} c/u)</span>
                        <span>$${(item.cantidad * item.precio).toFixed(2)}
                            <button class="ml-3 text-red-500 hover:text-red-700" data-index="${index}"><i class="fas fa-times-circle"></i></button>
                        </span>
                    `;
                    cartItemsDiv.appendChild(itemDiv);
                });
            }
            cartTotalSpan.textContent = calculateCartTotal().toFixed(2);
        }

        function calculateCartTotal() {
            return carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
        }

        addToCartButton.addEventListener('click', () => {
            const selectedOption = selectProducto.options[selectProducto.selectedIndex];
            if (!selectedOption.value) {
                showNotification('Por favor, selecciona un producto.', 'error');
                return;
            }

            const id_producto = parseInt(selectedOption.value);
            const nombre_producto = selectedOption.textContent.split('(')[0].trim(); // Extract name
            const precio_text = selectedOption.getAttribute('data-price');
            const precio = parseFloat(precio_text);
            const cantidad = parseInt(cantidadProducto.value);
            const stockDisponible = parseInt(selectedOption.getAttribute('data-stock'));


            if (isNaN(cantidad) || cantidad <= 0) {
                showNotification('La cantidad debe ser un número positivo.', 'error');
                return;
            }

            const existingItemIndex = carrito.findIndex(item => item.id_producto === id_producto);
            let cantidadEnCarrito = existingItemIndex > -1 ? carrito[existingItemIndex].cantidad : 0;

            if (stockDisponible < (cantidadEnCarrito + cantidad)) {
                 showNotification(`No hay suficiente stock para ${nombre_producto}. Stock disponible: ${stockDisponible}. Ya tienes ${cantidadEnCarrito} en el carrito.`, 'error');
                return;
            }

            if (existingItemIndex > -1) {
                // Si el producto ya está en el carrito, actualiza la cantidad
                carrito[existingItemIndex].cantidad += cantidad;
            } else {
                // Si es un producto nuevo, añádelo al carrito
                carrito.push({ id_producto, nombre_producto, cantidad, precio });
            }
            showNotification(`${cantidad}x ${nombre_producto} añadido al carrito.`);
            updateCartDisplay();
            cantidadProducto.value = 1; // Reset quantity
        });

        cartItemsDiv.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                const indexToRemove = parseInt(e.target.closest('button').dataset.index);
                carrito.splice(indexToRemove, 1);
                showNotification('Producto eliminado del carrito.', 'success');
                updateCartDisplay();
            }
        });

        submitPedidoButton.addEventListener('click', async () => {
            const id_cliente = parseInt(selectCliente.value);
            if (isNaN(id_cliente)) {
                showNotification('Por favor, selecciona un cliente.', 'error');
                return;
            }
            if (carrito.length === 0) {
                showNotification('El carrito de pedido está vacío.', 'error');
                return;
            }

            // Mapear el carrito al formato esperado por la API
            const detallesAPI = carrito.map(item => ({
                id_producto: item.id_producto,
                cantidad: item.cantidad,
                precio: item.precio // La API usará su propio precio, pero es buena práctica enviarlo
            }));

            const response = await createPedido(id_cliente, detallesAPI);
            if (response) {
                carrito = []; // Limpiar carrito después de crear el pedido
                updateCartDisplay();
                await navigate('#pedidos'); // Redirigir a la vista de pedidos
            }
        });

        updateCartDisplay(); // Inicializar el carrito
    }


    // --- GESTIÓN DE VISTAS Y NAVEGACIÓN ---
    function setActiveLink(hash) {
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === hash) {
                link.classList.add('active');
            }
        });
    }

    // <-- FIX AQUÍ: Se añade "window." para hacer la función global y accesible desde el HTML.
    window.navigate = async (hash) => {
        setActiveLink(hash);
        switch (hash) {
            case '#pedidos':
                await renderPedidos();
                break;
            case '#repartidores':
                await renderRepartidores();
                break;
            case '#clientes':
                await renderClientes();
                break;
            case '#productos':
                await renderProductos();
                break;
            case '#nuevo-pedido':
                await renderNuevoPedido();
                break;
            default:
                // Por defecto, ir a pedidos si no hay hash o es desconocido
                window.location.hash = '#pedidos';
                await renderPedidos();
                break;
        }
    }

    // Funciones globales para ser accesibles desde el onclick en el HTML generado
    window.showAddRepartidorForm = async () => {
        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Agregar Nuevo Repartidor</h2>
            <form id="add-repartidor-form" class="bg-white p-6 rounded-lg shadow-md">
                <div class="mb-4">
                    <label for="rep-nombre" class="block text-gray-700 font-semibold mb-2">Nombre Completo</label>
                    <input type="text" id="rep-nombre" name="nombre_completo" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="rep-telefono" class="block text-gray-700 font-semibold mb-2">Teléfono</label>
                    <input type="text" id="rep-telefono" name="telefono" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="rep-vehiculo" class="block text-gray-700 font-semibold mb-2">Vehículo</label>
                    <input type="text" id="rep-vehiculo" name="vehiculo" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-6">
                    <label for="rep-estado" class="block text-gray-700 font-semibold mb-2">Estado</label>
                    <select id="rep-estado" name="estado" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="disponible">Disponible</option>
                        <option value="ocupado">Ocupado</option>
                        <option value="inactivo">Inactivo</option>
                    </select>
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Guardar Repartidor</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#repartidores')">Cancelar</button>
            </form>
        `;
        document.getElementById('add-repartidor-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                nombre_completo: e.target['rep-nombre'].value,
                telefono: e.target['rep-telefono'].value,
                vehiculo: e.target['rep-vehiculo'].value,
                estado: e.target['rep-estado'].value
            };
            const response = await createRepartidor(data.nombre_completo, data.telefono, data.vehiculo, data.estado);
            if (response) {
                navigate('#repartidores');
            }
        });
    };

    window.showEditRepartidorForm = async (id) => {
        const repartidor = await getSingleRepartidor(id);
        if (!repartidor) {
            showNotification('Repartidor no encontrado.', 'error');
            return;
        }
        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Editar Repartidor</h2>
            <form id="edit-repartidor-form" class="bg-white p-6 rounded-lg shadow-md">
                <input type="hidden" id="rep-id" name="id_repartidor" value="${repartidor.id_repartidor}">
                <div class="mb-4">
                    <label for="rep-nombre" class="block text-gray-700 font-semibold mb-2">Nombre Completo</label>
                    <input type="text" id="rep-nombre" name="nombre_completo" value="${repartidor.nombre_completo}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="rep-telefono" class="block text-gray-700 font-semibold mb-2">Teléfono</label>
                    <input type="text" id="rep-telefono" name="telefono" value="${repartidor.telefono}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="rep-vehiculo" class="block text-gray-700 font-semibold mb-2">Vehículo</label>
                    <input type="text" id="rep-vehiculo" name="vehiculo" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" value="${repartidor.vehiculo}" required>
                </div>
                <div class="mb-6">
                    <label for="rep-estado" class="block text-gray-700 font-semibold mb-2">Estado</label>
                    <select id="rep-estado" name="estado" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="disponible" ${repartidor.estado === 'disponible' ? 'selected' : ''}>Disponible</option>
                        <option value="ocupado" ${repartidor.estado === 'ocupado' ? 'selected' : ''}>Ocupado</option>
                        <option value="inactivo" ${repartidor.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                    </select>
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Actualizar Repartidor</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#repartidores')">Cancelar</button>
            </form>
        `;
        document.getElementById('edit-repartidor-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                id_repartidor: parseInt(e.target['rep-id'].value),
                nombre_completo: e.target['rep-nombre'].value,
                telefono: e.target['rep-telefono'].value,
                vehiculo: e.target['rep-vehiculo'].value,
                estado: e.target['rep-estado'].value
            };
            const response = await updateRepartidor(data.id_repartidor, data.nombre_completo, data.telefono, data.vehiculo, data.estado);
            if (response) {
                navigate('#repartidores');
            }
        });
    };

    window.handleDeleteRepartidor = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este repartidor?')) {
            await deleteRepartidor(id);
        }
    };

    window.showAddClienteForm = async () => {
        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Agregar Nuevo Cliente</h2>
            <form id="add-cliente-form" class="bg-white p-6 rounded-lg shadow-md">
                <div class="mb-4">
                    <label for="cli-nombre" class="block text-gray-700 font-semibold mb-2">Nombre Completo</label>
                    <input type="text" id="cli-nombre" name="nombre_completo" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="cli-direccion" class="block text-gray-700 font-semibold mb-2">Dirección</label>
                    <input type="text" id="cli-direccion" name="direccion" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-6">
                    <label for="cli-telefono" class="block text-gray-700 font-semibold mb-2">Teléfono</label>
                    <input type="text" id="cli-telefono" name="telefono" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Guardar Cliente</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#clientes')">Cancelar</button>
            </form>
        `;
        document.getElementById('add-cliente-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                nombre_completo: e.target['cli-nombre'].value,
                direccion: e.target['cli-direccion'].value,
                telefono: e.target['cli-telefono'].value
            };
            const response = await createCliente(data.nombre_completo, data.direccion, data.telefono);
            if (response) {
                navigate('#clientes');
            }
        });
    };

    window.showEditClienteForm = async (id) => {
        const cliente = await getSingleCliente(id);
        if (!cliente) {
            showNotification('Cliente no encontrado.', 'error');
            return;
        }
        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Editar Cliente</h2>
            <form id="edit-cliente-form" class="bg-white p-6 rounded-lg shadow-md">
                <input type="hidden" id="cli-id" name="id_cliente" value="${cliente.id_cliente}">
                <div class="mb-4">
                    <label for="cli-nombre" class="block text-gray-700 font-semibold mb-2">Nombre Completo</label>
                    <input type="text" id="cli-nombre" name="nombre_completo" value="${cliente.nombre_completo}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="cli-direccion" class="block text-gray-700 font-semibold mb-2">Dirección</label>
                    <input type="text" id="cli-direccion" name="direccion" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" value="${cliente.direccion}" required>
                </div>
                <div class="mb-6">
                    <label for="cli-telefono" class="block text-gray-700 font-semibold mb-2">Teléfono</label>
                    <input type="text" id="cli-telefono" name="telefono" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" value="${cliente.telefono}" required>
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Actualizar Cliente</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#clientes')">Cancelar</button>
            </form>
        `;
        document.getElementById('edit-cliente-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                id_cliente: parseInt(e.target['cli-id'].value),
                nombre_completo: e.target['cli-nombre'].value,
                direccion: e.target['cli-direccion'].value,
                telefono: e.target['cli-telefono'].value
            };
            const response = await updateCliente(data.id_cliente, data.nombre_completo, data.direccion, data.telefono);
            if (response) {
                navigate('#clientes');
            }
        });
    };

    window.handleDeleteCliente = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            await deleteCliente(id);
        }
    };

    window.showAddProductoForm = async () => {
        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Agregar Nuevo Producto</h2>
            <form id="add-producto-form" class="bg-white p-6 rounded-lg shadow-md">
                <div class="mb-4">
                    <label for="prod-nombre" class="block text-gray-700 font-semibold mb-2">Nombre del Producto</label>
                    <input type="text" id="prod-nombre" name="nombre" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="prod-descripcion" class="block text-gray-700 font-semibold mb-2">Descripción</label>
                    <textarea id="prod-descripcion" name="descripcion" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"></textarea>
                </div>
                <div class="mb-4">
                    <label for="prod-precio" class="block text-gray-700 font-semibold mb-2">Precio</label>
                    <input type="number" step="0.01" id="prod-precio" name="precio" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required min="0">
                </div>
                <div class="mb-4">
                    <label for="prod-stock" class="block text-gray-700 font-semibold mb-2">Stock</label>
                    <input type="number" id="prod-stock" name="stock" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required min="0">
                </div>
                <div class="mb-6">
                    <label for="prod-categoria" class="block text-gray-700 font-semibold mb-2">Categoría</label>
                    <input type="text" id="prod-categoria" name="categoria" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Guardar Producto</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#productos')">Cancelar</button>
            </form>
        `;
        document.getElementById('add-producto-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                nombre: e.target['prod-nombre'].value,
                descripcion: e.target['prod-descripcion'].value,
                precio: parseFloat(e.target['prod-precio'].value),
                stock: parseInt(e.target['prod-stock'].value),
                categoria: e.target['prod-categoria'].value
            };
            const response = await createProducto(data.nombre, data.descripcion, data.precio, data.stock, data.categoria);
            if (response) {
                navigate('#productos');
            }
        });
    };

    window.showEditProductoForm = async (id) => {
        const producto = await getSingleProducto(id);
        if (!producto) {
            showNotification('Producto no encontrado.', 'error');
            return;
        }
        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Editar Producto</h2>
            <form id="edit-producto-form" class="bg-white p-6 rounded-lg shadow-md">
                <input type="hidden" id="prod-id" name="id" value="${producto.id_producto}">
                <div class="mb-4">
                    <label for="prod-nombre" class="block text-gray-700 font-semibold mb-2">Nombre del Producto</label>
                    <input type="text" id="prod-nombre" name="nombre" value="${producto.nombre_producto}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                </div>
                <div class="mb-4">
                    <label for="prod-descripcion" class="block text-gray-700 font-semibold mb-2">Descripción</label>
                    <textarea id="prod-descripcion" name="descripcion" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">${producto.descripcion || ''}</textarea>
                </div>
                <div class="mb-4">
                    <label for="prod-precio" class="block text-gray-700 font-semibold mb-2">Precio</label>
                    <input type="number" step="0.01" id="prod-precio" name="precio" value="${producto.precio}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" required min="0">
                </div>
                <div class="mb-4">
                    <label for="prod-stock" class="block text-gray-700 font-semibold mb-2">Stock</label>
                    <input type="number" id="prod-stock" name="stock" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" value="${producto.stock}" required min="0">
                </div>
                <div class="mb-6">
                    <label for="prod-categoria" class="block text-gray-700 font-semibold mb-2">Categoría</label>
                    <input type="text" id="prod-categoria" name="categoria" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" value="${producto.categoria || ''}">
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Actualizar Producto</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#productos')">Cancelar</button>
            </form>
        `;
        document.getElementById('edit-producto-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                id: parseInt(e.target['prod-id'].value),
                nombre: e.target['prod-nombre'].value,
                descripcion: e.target['prod-descripcion'].value,
                precio: parseFloat(e.target['prod-precio'].value),
                stock: parseInt(e.target['prod-stock'].value),
                categoria: e.target['prod-categoria'].value
            };
            const response = await updateProducto(data.id, data.nombre, data.descripcion, data.precio, data.stock, data.categoria);
            if (response) {
                navigate('#productos');
            }
        });
    };

    window.handleDeleteProducto = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            await deleteProducto(id);
        }
    };

    window.viewPedidoDetails = async (id) => {
        const pedido = await getSinglePedido(id);
        if (!pedido) {
            showNotification('Detalles del pedido no encontrados.', 'error');
            return;
        }

        let detailsHtml = `
            <h2 class="text-2xl font-bold mb-4">Detalles del Pedido #${pedido.id_pedido}</h2>
            <div class="bg-white p-6 rounded-lg shadow-md mb-6">
                <p><strong>Estado:</strong> ${pedido.estado_pedido}</p>
                <p><strong>Fecha:</strong> ${new Date(pedido.fecha_pedido).toLocaleString()}</p>
                <p><strong>Total:</strong> $${parseFloat(pedido.total_pedido).toFixed(2)}</p>
                <h3 class="text-xl font-semibold mt-4 mb-2">Cliente:</h3>
                <p><strong>Nombre:</strong> ${pedido.cliente_nombre || 'N/A'}</p>
                <p><strong>Dirección:</strong> ${pedido.cliente_direccion || 'N/A'}</p>
                <p><strong>Teléfono:</strong> ${pedido.cliente_telefono || 'N/A'}</p>
        `;
        if (pedido.id_repartidor) {
            detailsHtml += `
                <h3 class="text-xl font-semibold mt-4 mb-2">Repartidor Asignado:</h3>
                <p><strong>Nombre:</strong> ${pedido.repartidor_nombre || 'N/A'}</p>
                <p><strong>Teléfono:</strong> ${pedido.repartidor_telefono || 'N/A'}</p>
                <p><strong>Vehículo:</strong> ${pedido.repartidor_vehiculo || 'N/A'}</p>
            `;
        } else {
            detailsHtml += `<p class="text-gray-600 mt-4">No hay repartidor asignado.</p>`;
        }

        detailsHtml += `
                <h3 class="text-xl font-semibold mt-4 mb-2">Productos del Pedido:</h3>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;
        if (pedido.detalles && pedido.detalles.length > 0) {
            pedido.detalles.forEach(item => {
                detailsHtml += `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">${item.producto_nombre}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${item.cantidad}</td>
                            <td class="px-6 py-4 whitespace-nowrap">$${parseFloat(item.precio_unitario).toFixed(2)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">$${(item.cantidad * parseFloat(item.precio_unitario)).toFixed(2)}</td>
                        </tr>
                `;
            });
        } else {
            detailsHtml += `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No hay detalles de productos para este pedido.</td></tr>`;
        }
        detailsHtml += `
                    </tbody>
                </table>
                <button type="button" class="mt-6 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#pedidos')">Volver a Pedidos</button>
            </div>
        `;
        appContent.innerHTML = detailsHtml;
    };

    window.editPedidoStatus = async (id_pedido, current_status, current_repartidor_id) => {
        await getRepartidores(); // Necesario para la lista desplegable de repartidores

        let repartidoresOptions = repartidores.filter(r => r.estado === 'disponible' || r.id_repartidor === current_repartidor_id)
            .map(r => `<option value="${r.id_repartidor}" ${r.id_repartidor === current_repartidor_id ? 'selected' : ''}>${r.nombre_completo} (${r.estado})</option>`).join('');

        // Añadir el repartidor actual si no está "disponible" pero está asignado
        if (current_repartidor_id && !repartidores.some(r => r.id_repartidor === current_repartidor_id && r.estado === 'disponible')) {
             const currentRep = repartidores.find(r => r.id_repartidor === current_repartidor_id);
             if (currentRep) {
                 repartidoresOptions = `<option value="${currentRep.id_repartidor}" selected>${currentRep.nombre_completo} (${currentRep.estado})</option>` + repartidoresOptions;
             }
        }
        if (repartidoresOptions.indexOf('selected') === -1 && current_repartidor_id) { // Si el repartidor actual no está en la lista (ej. eliminado)
             repartidoresOptions = `<option value="${current_repartidor_id}" selected>Repartidor ID: ${current_repartidor_id} (Anterior)</option>` + repartidoresOptions;
        }


        const estadoOptions = [
            'Pendiente',
            'En preparación',
            'En camino',
            'Entregado',
            'Cancelado'
        ].map(estado => `<option value="${estado}" ${estado === current_status ? 'selected' : ''}>${estado}</option>`).join('');

        appContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Actualizar Estado del Pedido #${id_pedido}</h2>
            <form id="update-pedido-status-form" class="bg-white p-6 rounded-lg shadow-md">
                <input type="hidden" id="pedido-id" value="${id_pedido}">
                <input type="hidden" id="repartidor-anterior-id" value="${current_repartidor_id || ''}">
                <div class="mb-4">
                    <label for="new-status" class="block text-gray-700 font-semibold mb-2">Nuevo Estado</label>
                    <select id="new-status" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        ${estadoOptions}
                    </select>
                </div>
                <div class="mb-6" id="repartidor-assign-div" style="display: ${current_status === 'En camino' || current_status === 'En preparación' ? 'block' : 'none'};">
                    <label for="assign-repartidor" class="block text-gray-700 font-semibold mb-2">Asignar Repartidor</label>
                    <select id="assign-repartidor" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="">-- No Asignar --</option>
                        ${repartidoresOptions}
                    </select>
                </div>
                <button type="submit" class="bg-cyan-600 text-white py-2 px-4 rounded-lg hover:bg-cyan-700 transition duration-300 font-semibold">Actualizar Estado</button>
                <button type="button" class="ml-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-300" onclick="navigate('#pedidos')">Cancelar</button>
            </form>
        `;

        const newStatusSelect = document.getElementById('new-status');
        const repartidorAssignDiv = document.getElementById('repartidor-assign-div');

        newStatusSelect.addEventListener('change', () => {
            if (newStatusSelect.value === 'En camino') {
                repartidorAssignDiv.style.display = 'block';
            } else {
                repartidorAssignDiv.style.display = 'none';
                document.getElementById('assign-repartidor').value = ''; // Clear selection if not 'En camino'
            }
        });

        document.getElementById('update-pedido-status-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newStatus = newStatusSelect.value;
            const assignedRepartidorId = document.getElementById('assign-repartidor').value;
            const idRepartidorAnterior = document.getElementById('repartidor-anterior-id').value;

            // Validar que si el estado es 'En camino', haya un repartidor asignado
            if (newStatus === 'En camino' && !assignedRepartidorId) {
                showNotification('Debe asignar un repartidor para cambiar el estado a "En camino".', 'error');
                return;
            }

            const response = await updatePedidoStatus(
                id_pedido,
                newStatus,
                assignedRepartidorId ? parseInt(assignedRepartidorId) : null,
                idRepartidorAnterior ? parseInt(idRepartidorAnterior) : null
            );
            if (response) {
                navigate('#pedidos');
            }
        });
    };


    // --- MANEJADORES GLOBALES Y INICIALIZACIÓN ---

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const response = await fetch(`${API_URL}login.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('authToken', result.jwt);
                localStorage.setItem('userData', JSON.stringify(result.user));

                loginScreen.style.display = 'none';
                mainApp.style.display = 'flex';
                await navigate(window.location.hash);
            } else {
                loginError.textContent = result.message || 'Error desconocido.';
            }
        } catch (error) {
            console.error('Error de conexión al iniciar sesión:', error);
            loginError.textContent = 'No se puede conectar con el servidor. Verifique la URL de la API.';
        }
    });

    function logoutUser() {
        localStorage.clear();
        window.location.hash = ''; // Limpiar el hash de la URL
        mainApp.style.display = 'none';
        loginScreen.style.display = 'flex';
        carrito = []; // Limpiar carrito al cerrar sesión
        showNotification('Sesión cerrada.', 'success');
    }

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
    });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            window.location.hash = e.currentTarget.getAttribute('href');
        });
    });

    window.addEventListener('hashchange', () => navigate(window.location.hash));

    const checkSession = async () => {
        if (localStorage.getItem('authToken')) {
            loginScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            // Al recargar, intenta navegar a la última ruta o a 'pedidos' por defecto.
            // Las funciones fetchData/sendData validarán el token con cada petición.
            await navigate(window.location.hash || '#pedidos');
        } else {
            loginScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        }
    };

    checkSession();

});
