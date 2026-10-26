require('dotenv').config();
const express=require('express');
const cors=require('cors');
const twilio=require('twilio');

const app=express();
app.use(cors());
app.use(express.json({limit:'100kb'}));

const required=['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PHONE','ADMIN_PHONE'];
for(const key of required){
  if(!process.env[key]) console.warn(`Falta la variable ${key}`);
}

const client=twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN);

app.post('/api/solicitud',async(req,res)=>{
  try{
    const {contact,search}=req.body||{};
    if(!contact?.name||!contact?.phone||!contact?.email||!search){
      return res.status(400).json({error:'Faltan datos de contacto o de la búsqueda.'});
    }

    const rooms=Array.isArray(search.roomData)
      ? search.roomData.map((room,i)=>{
          const children=Array.isArray(room.children)&&room.children.length
            ? `, niños: ${room.children.join(', ')} años`
            : '';
          return `Hab. ${i+1}: ${room.adults} adultos${children}`;
        }).join(' | ')
      : '';

    let dates;
    if(search.dateType==='concrete'){
      dates=`${search.departure||'-'} → ${search.return||'-'}`;
    }else{
      dates=`Flexibles: ${search.flexibleType||'-'}`;
      if(search.flexibleDays!=null) dates+=`, ${search.flexibleDays} días`;
      if(search.selectedMonth) dates+=`, mes ${search.selectedMonth}`;
    }

    let body=`NUEVA SOLICITUD VIAJA\n\n`+
      `Cliente: ${contact.name}\n`+
      `Teléfono: ${contact.phone}\n`+
      `Email: ${contact.email}\n\n`+
      `Viaje: ${search.origin||'-'} → ${search.destination||'-'}\n`+
      `Fechas: ${dates}\n`+
      `Habitaciones: ${search.rooms||0}\n`+
      `Personas: ${search.adults||0} adultos, ${search.children||0} niños\n`+
      (rooms?`${rooms}\n`: '');

    if(search.multidestination){
      body+=`\n2º trayecto: ${search.origin2||'-'} → ${search.destination2||'-'}\n`;
      if(search.departure2){
        body+=`Fechas 2: ${search.departure2} → ${search.return2||'-'}\n`;
      }else{
        body+=`Fechas 2 flexibles: ${search.flexibleType2||'-'}`;
        if(search.flexibleDays2!=null) body+=`, ${search.flexibleDays2} días`;
        if(search.selectedMonth2) body+=`, mes ${search.selectedMonth2}`;
        body+='\n';
      }
      body+=`Habitaciones 2º trayecto: ${search.rooms2||1}; ${search.adults2||1} adultos, ${search.children2||0} niños\n`;
      if(Array.isArray(search.extraTrips)){
        search.extraTrips.forEach((trip,i)=>{
          body+=`\nTrayecto ${i+3}: ${trip.origin||'-'} → ${trip.destination||'-'}\n`+
            `Fechas: ${trip.departure||'-'} → ${trip.return||'-'}\n`+
            `Habitaciones: ${trip.rooms||1}; ${trip.adults||1} adultos, ${trip.children||0} niños\n`;
        });
      }
    }

    const message=await client.messages.create({
      body,
      from:process.env.TWILIO_PHONE,
      to:process.env.ADMIN_PHONE
    });

    res.json({ok:true,messageSid:message.sid});
  }catch(error){
    console.error(error);
    res.status(500).json({error:'No se pudo enviar el SMS.'});
  }
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Servidor funcionando en el puerto ${PORT}`));
