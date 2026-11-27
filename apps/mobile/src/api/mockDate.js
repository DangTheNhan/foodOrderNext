// src/api/mockData.js
export const mockOrders = [
    {
        idOrder: 1,
        orderDate: "2026-07-15",
        status: "confirmed",
        totalPrice: 150000,
        orderDetails: [
            { idOrderDetail: 1, product: { nameProduct: "Cà phê sữa" }, quantity: 2, subTotal: 50000 },
            { idOrderDetail: 2, product: { nameProduct: "Bánh mì" }, quantity: 1, subTotal: 100000 }
        ]
    }
];