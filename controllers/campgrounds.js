const Campground = require('../models/campground');
const maptilerClient = require("@maptiler/client");
maptilerClient.config.apiKey = process.env.MAPTILER_API_KEY;
const { cloudinary } = require("../cloudinary");


module.exports.index = async (req, res) => {
    const campgrounds = await Campground.find({}).populate('popupText');
    res.render('campgrounds/index', { campgrounds })
}

module.exports.renderNewForm = (req, res) => {
    res.render('campgrounds/new');
}

module.exports.createCampground = async (req, res, next) => {
    try {
        const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
        
        // Log geoData to see what you're getting
        console.log('GeoData:', geoData);

        if (!geoData.features || geoData.features.length === 0) {
            req.flash('error', 'Location not found. Please enter a valid location.');
            return res.redirect('/campgrounds/new');
        }

        const campground = new Campground(req.body.campground);
        campground.geometry = geoData.features[0].geometry;
        campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
        campground.author = req.user._id;
        await campground.save();

        console.log(campground);
        req.flash('success', 'Successfully made a new campground!');
        res.redirect(`/campgrounds/${campground._id}`);
    } catch (error) {
        console.error('Error creating campground:', error);
        req.flash('error', 'Could not create campground. Please try again.');
        res.redirect('/campgrounds/new');
    }
}

module.exports.showCampground = async (req, res,) => {
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/show', { campground });
}

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findById(id)
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/edit', { campground });
}

module.exports.updateCampground = async (req, res) => {
    const { id } = req.params;
    console.log(req.body);

    try {
        const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground });
        const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });

        // Log geoData to see what you're getting
        console.log('GeoData:', geoData);

        if (!geoData.features || geoData.features.length === 0) {
            req.flash('error', 'Location not found. Please enter a valid location.');
            return res.redirect(`/campgrounds/${campground._id}/edit`);
        }

        campground.geometry = geoData.features[0].geometry;
        const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
        campground.images.push(...imgs);
        await campground.save();

        if (req.body.deleteImages) {
            for (let filename of req.body.deleteImages) {
                await cloudinary.uploader.destroy(filename);
            }
            await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
        }

        req.flash('success', 'Successfully updated campground!');
        res.redirect(`/campgrounds/${campground._id}`);
    } catch (error) {
        console.error('Error updating campground:', error);
        req.flash('error', 'Could not update campground. Please try again.');
        res.redirect(`/campgrounds/${id}/edit`);
    }
}

module.exports.deleteCampground = async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Successfully deleted campground')
    res.redirect('/campgrounds');
}