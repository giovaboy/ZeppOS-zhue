import { MESSAGE_KEYS } from './constants.js'

class MessageHandler {
  constructor() {
    this.listeners = new Map()
  }

  // Send message to companion app
  send(key, data) {
    try {
      const message = { [key]: data }
      console.log('Sending message:', message)

      // Use ZeppOS messaging API
      return Promise.resolve() // Placeholder for actual implementation
    } catch (error) {
      console.error('Message send error:', error)
      return Promise.reject(error)
    }
  }

  // Add message listener
  on(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, [])
    }
    this.listeners.get(key).push(callback)
  }

  // Remove message listener
  off(key, callback) {
    const listeners = this.listeners.get(key)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Handle incoming message
  handleMessage(message) {
    Object.entries(message).forEach(([key, data]) => {
      const listeners = this.listeners.get(parseInt(key))
      if (listeners) {
        listeners.forEach(callback => callback(data))
      }
    })
  }
}

export const messageHandler = new MessageHandler()