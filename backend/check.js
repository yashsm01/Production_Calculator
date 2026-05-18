const mongoose = require('mongoose');
const { collectAllInputVariables } = require('./services/dependencyResolver');

mongoose.connect('mongodb://127.0.0.1:27017/calculator').then(async () => {
  try {
    const catId = '69ffa0fe4c2579a9521939d0';
    
    // Replicate the EXACT query from productController
    const params = await mongoose.connection.db.collection('parameters').find({
      $or: [
        { categoryIds: { $in: [new mongoose.Types.ObjectId(catId)] } },
        { categoryIds: { $size: 0 } },
        { categoryIds: { $exists: false } }
      ]
    }).toArray();
    
    console.log('Params loaded:', params.length);
    console.log('Keys:', params.map(p => p.key));
    
    // Simulate collectAllInputVariables with these params
    const inputVars = collectAllInputVariables(params);
    console.log('Required input vars:', inputVars);
    
    const provided = ["weight","rejected_per","resin_consuption_ip","cavity","cycle_time","pack_size","fix_cost","varr_cost_qty","varr_cost_ip","elec_unit_kwh","elec_unit_val","ibm_mould","recovery_years","per_year_qty","gamma_rate_per_box","bottle_pack_qty","cap_pack_qty","nozz_pack_qty","valsad_to_guwahati","total_sell_qty","rm_price_kg","mb_price_kg","packing_nos","profit_per","marketing_cost_per","b1_total_no_of_boxes"];
    const missing = inputVars.filter(v => !provided.includes(v));
    console.log('Missing:', missing);
    
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
