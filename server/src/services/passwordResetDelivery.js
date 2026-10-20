import { createTokenDelivery } from './testTokenDelivery.js'
const delivery = createTokenDelivery()
export const setTestResetCapture = delivery.setCapture
export const deliverPasswordReset = delivery.deliver
