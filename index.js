import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()

app.use(cors())
app.use(express.json())

const supabaseUrl = 'https://eaczccnkbgbvtbtuvlbq.supabase.co'

const supabaseKey = 'sb_publishable_OZqq96SpvD6dOpuN5W_DeA_WFeyGbxS'

const supabase = createClient(supabaseUrl, supabaseKey)

app.post('/api/chat', async (req, res) => {

  const { message } = req.body

  if (!message) {
    return res.json({
      reply: 'No message received.'
    })
  }

  // MEMORY SAVE LOOP
  if (message.toLowerCase().startsWith('remember ')) {

    const memoryText = message.replace(/^remember\s+/i, '')

    const { error } = await supabase
      .from('memories')
      .insert([
        {
          persona: 'big_puppy',
          memory_text: memoryText,
          category: 'user_memory',
          confirmed: true,
          private: true
        }
      ])

    if (error) {
      return res.json({
        reply: 'Memory save failed.',
        error
      })
    }

    return res.json({
      reply: "Okay. I'll remember that."
    })
  }

  return res.json({
    reply: 'ARCHE online.'
  })

})

app.listen(3000, () => {
  console.log('ARCHE running on http://localhost:3000')
})