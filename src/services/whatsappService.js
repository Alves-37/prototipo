const https = require('https');

class WhatsAppService {
  constructor() {
    this.enabled = false;
    this.provider = process.env.WHATSAPP_PROVIDER || 'development';
    
    // Configurar baseado no provider
    this.setupProvider();
  }

  setupProvider() {
    switch (this.provider) {
      case 'callmebot':
        this.setupCallMeBot();
        break;
      case 'development':
      default:
        console.log('[WhatsAppService] Usando modo desenvolvimento');
        this.enabled = false;
    }
  }

  setupCallMeBot() {
    // CallMeBot é gratuito e não precisa de API key
    this.enabled = true;
    console.log('[WhatsAppService] Serviço habilitado com CallMeBot (grátis)');
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
        case 'callmebot':
          return await this.sendViaCallMeBot(phoneNumber, message);
        default:
          console.log(`[WhatsAppService] Provider ${this.provider} não implementado`);
          return false;
      }
    } catch (error) {
      console.error('[WhatsAppService] Erro ao enviar mensagem:', error);
      return false;
    }
  }

  async sendViaCallMeBot(phoneNumber, message) {
    return new Promise((resolve, reject) => {
      // CallMeBot - serviço gratuito
      // Limitações: 1 mensagem a cada 10 segundos, máximo 20 mensagens por dia
      
      const cleanPhone = phoneNumber.replace('+', '');
      const encodedMessage = encodeURIComponent(message);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMessage}`;

      const req = https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (data.includes('Message sent') || data.includes('OK')) {
            console.log(`[WhatsAppService] Código enviado via CallMeBot para ${phoneNumber}`);
            resolve(true);
          } else {
            console.error('[WhatsAppService] Erro CallMeBot:', data);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('[WhatsAppService] Erro requisição CallMeBot:', err);
        resolve(false);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        console.error('[WhatsAppService] Timeout CallMeBot');
        resolve(false);
      });
    });
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
 
     // Se já está em E.164 (+XXXXXXXX...), valida de forma básica
     // (8 a 15 dígitos é o padrão do E.164)
     const raw = String(phone).trim()
     if (raw.startsWith('+')) {
       const digits = raw.replace(/\D/g, '')
       if (digits.length >= 8 && digits.length <= 15) {
         return `+${digits}`
       }
       return null
     }
 
     // Remove todos os caracteres não numéricos
     const cleaned = raw.replace(/\D/g, '')
 
     // Moçambique (9 dígitos local) -> +258XXXXXXXXX
     // Também aceita já com 258 (12 dígitos)
     if (cleaned.length === 9) {
       return `+258${cleaned}`
     }
     if (cleaned.length === 12 && cleaned.startsWith('258')) {
       return `+${cleaned}`
     }
 
     // Brasil (10 ou 11 dígitos local) -> +55XXXXXXXXXXX
     // Também aceita já com 55 (12 ou 13 dígitos)
     if (cleaned.length === 10 || cleaned.length === 11) {
       return `+55${cleaned}`
     }
     if ((cleaned.length === 12 || cleaned.length === 13) && cleaned.startsWith('55')) {
       return `+${cleaned}`
     }
 
     return null
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
