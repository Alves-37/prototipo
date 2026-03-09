let twilio;
let axios;

// Import condicional para não dar erro se não estiver instalado
try {
  twilio = require('twilio');
} catch (err) {
  console.log('[WhatsAppService] Twilio não instalado - provider Twilio desabilitado');
}

try {
  axios = require('axios');
} catch (err) {
  console.log('[WhatsAppService] Axios não instalado - provider CallMeBot/UltraMsg desabilitado');
}

class WhatsAppService {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.provider = process.env.WHATSAPP_PROVIDER || 'twilio'; // twilio, callmebot, development
    
    // Configurar baseado no provider
    this.setupProvider();
  }

  setupProvider() {
    switch (this.provider) {
      case 'twilio':
        this.setupTwilio();
        break;
      case 'callmebot':
        this.setupCallMeBot();
        break;
      case 'ultramsg':
        this.setupUltraMsg();
        break;
      default:
        console.log('[WhatsAppService] Usando modo desenvolvimento');
        this.enabled = false;
    }
  }

  setupTwilio() {
    if (!twilio) {
      console.log('[WhatsAppService] Twilio não disponível - instale com npm install twilio');
      this.enabled = false;
      return;
    }
    
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      this.enabled = true;
      console.log('[WhatsAppService] Serviço habilitado com Twilio');
    } else {
      console.log('[WhatsAppService] Credenciais Twilio não configuradas');
      this.enabled = false;
    }
  }

  setupCallMeBot() {
    if (!axios) {
      console.log('[WhatsAppService] Axios não disponível - instale com npm install axios');
      this.enabled = false;
      return;
    }
    
    // CallMeBot é gratuito e não precisa de API key
    this.enabled = true;
    console.log('[WhatsAppService] Serviço habilitado com CallMeBot (grátis)');
  }

  setupUltraMsg() {
    if (!axios) {
      console.log('[WhatsAppService] Axios não disponível - instale com npm install axios');
      this.enabled = false;
      return;
    }
    
    if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
      this.enabled = true;
      console.log('[WhatsAppService] Serviço habilitado com UltraMsg');
    } else {
      console.log('[WhatsAppService] Credenciais UltraMsg não configuradas');
      this.enabled = false;
    }
  }

  /**
   * Envia um código de verificação via WhatsApp
   * @param {string} phoneNumber - Número de telefone do destinatário (formato: +55XXXXXXXXXXX)
   * @param {string} code - Código de verificação
   * @param {string} userName - Nome do usuário (opcional)
   * @returns {Promise<boolean>} - True se enviado com sucesso, false caso contrário
   */
  async sendVerificationCode(phoneNumber, code, userName = '') {
    if (!this.enabled) {
      console.log(`[WhatsAppService] Modo desenvolvimento - Código para ${phoneNumber}: ${code}`);
      return true;
    }

    try {
      const message = this.formatVerificationMessage(code, userName);
      
      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(phoneNumber, message);
        case 'callmebot':
          return await this.sendViaCallMeBot(phoneNumber, message);
        case 'ultramsg':
          return await this.sendViaUltraMsg(phoneNumber, message);
        default:
          console.log(`[WhatsAppService] Provider ${this.provider} não implementado`);
          return false;
      }
    } catch (error) {
      console.error('[WhatsAppService] Erro ao enviar mensagem:', error);
      return false;
    }
  }

  async sendViaTwilio(phoneNumber, message) {
    await this.client.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phoneNumber}`
    });
    console.log(`[WhatsAppService] Código enviado via Twilio para ${phoneNumber}`);
    return true;
  }

  async sendViaCallMeBot(phoneNumber, message) {
    // CallMeBot - serviço gratuito
    // Limitações: 1 mensagem a cada 10 segundos, máximo 20 mensagens por dia
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneNumber.replace('+', '')}&text=${encodeURIComponent(message)}`;
    
    const response = await axios.get(url);
    if (response.data.includes('Message sent')) {
      console.log(`[WhatsAppService] Código enviado via CallMeBot para ${phoneNumber}`);
      return true;
    } else {
      console.error('[WhatsAppService] Erro CallMeBot:', response.data);
      return false;
    }
  }

  async sendViaUltraMsg(phoneNumber, message) {
    // UltraMsg - tem plano gratuito
    const url = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`;
    
    const data = {
      token: process.env.ULTRAMSG_TOKEN,
      to: phoneNumber,
      body: message
    };

    const response = await axios.post(url, data);
    if (response.data.status === 'sent') {
      console.log(`[WhatsAppService] Código enviado via UltraMsg para ${phoneNumber}`);
      return true;
    } else {
      console.error('[WhatsAppService] Erro UltraMsg:', response.data);
      return false;
    }
  }

  /**
   * Formata a mensagem de verificação
   * @param {string} code - Código de verificação
   * @param {string} userName - Nome do usuário
   * @returns {string} - Mensagem formatada
   */
  formatVerificationMessage(code, userName) {
    const greeting = userName ? `Olá, ${userName}!` : 'Olá!';
    return `${greeting} Seu código de recuperação de senha da Nevú é: *${code}*

Este código expira em 15 minutos. Não compartilhe com ninguém.

Se você não solicitou esta recuperação, ignore esta mensagem.`;
  }

  /**
   * Valida formato de número de telefone
   * @param {string} phone - Número de telefone
   * @returns {string} - Número formatado ou null se inválido
   */
  validatePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove todos os caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Verifica se é um número brasileiro (10 ou 11 dígitos)
    if (cleaned.length === 10 || cleaned.length === 11) {
      return `+55${cleaned}`;
    }
    
    // Se já começa com +, mantém
    if (phone.startsWith('+')) {
      return phone;
    }
    
    return null;
  }

  /**
   * Verifica se o serviço está habilitado
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Retorna o provider atual
   * @returns {string}
   */
  getProvider() {
    return this.provider;
  }
}

module.exports = new WhatsAppService();
